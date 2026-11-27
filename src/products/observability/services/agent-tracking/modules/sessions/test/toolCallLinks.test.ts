import type { Instance, Organization, Project } from '@mtsrc/agent-tracking-db';
import type { ToolCallLinkDocument } from '@mtsrc/agent-tracking-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aggregateSession, type SummaryRecord } from '../src/lib/summary';
import {
  maxSummaryMetorialIds,
  metorialSummaryOf,
  resolveSessionToolCallLinks,
  applyToolCallLinks,
  toolCallLinkId,
  writeToolCallLinks,
  type ToolCallLinkInput
} from '../src/lib/toolCallLinks';
import { toolCallLinkService } from '../src/services/toolCallLink';
import { summaryRecord } from './fixtures';

type Document = Record<string, any>;

let state = vi.hoisted(() => ({
  failLinkReads: false,
  repoIds: {} as Record<string, string[]>,
  links: [] as Record<string, any>[],
  events: [] as Record<string, any>[],
  settled: [] as string[][],
  eventWrites: 0
}));

let valueAt = (document: Document, path: string) =>
  path.split('.').reduce<any>((current, part) => current?.[part], document);

let matches = (document: Document, filter: Document) =>
  Object.entries(filter).every(([key, condition]) => {
    let value = valueAt(document, key);

    if (condition && typeof condition == 'object' && !Array.isArray(condition)) {
      if ('$in' in condition && !condition.$in.includes(value)) return false;
      if ('$ne' in condition && value === condition.$ne) return false;
      if ('$exists' in condition && (value !== undefined) != condition.$exists) return false;

      return true;
    }

    return value === condition;
  });

let setAt = (document: Document, path: string, value: unknown) => {
  let parts = path.split('.');
  let target = parts.slice(0, -1).reduce((current, part) => (current[part] ??= {}), document);
  target[parts[parts.length - 1]!] = structuredClone(value);
};

let unsetAt = (document: Document, path: string) => {
  let parts = path.split('.');
  let target = parts.slice(0, -1).reduce<any>((current, part) => current?.[part], document);
  if (target) delete target[parts[parts.length - 1]!];
};

let apply = (document: Document, update: Document, inserted: boolean) => {
  if (inserted) Object.assign(document, structuredClone(update.$setOnInsert ?? {}));
  for (let [path, value] of Object.entries(update.$set ?? {})) setAt(document, path, value);
  for (let path of Object.keys(update.$unset ?? {})) unsetAt(document, path);
};

let fakeCollection = (documents: () => Document[], onWrite?: () => void) => ({
  find: (filter: Document, options: { limit?: number } = {}) => ({
    toArray: async () =>
      structuredClone(documents().filter(document => matches(document, filter))).slice(
        0,
        options.limit ?? Infinity
      )
  }),
  bulkWrite: async (ops: Document[]) => {
    for (let op of ops) {
      onWrite?.();

      if (op.updateOne) {
        let found = documents().find(document => matches(document, op.updateOne.filter));
        if (found) apply(found, op.updateOne.update, false);
        else if (op.updateOne.upsert) {
          let created = { _id: op.updateOne.filter._id };
          apply(created, op.updateOne.update, true);
          documents().push(created);
        }
      }

      if (op.updateMany) {
        for (let document of documents().filter(document =>
          matches(document, op.updateMany.filter)
        )) {
          apply(document, op.updateMany.update, false);
        }
      }
    }
  }
});

vi.mock('@mtsrc/agent-tracking-store', () => ({
  defaultStoragePolicy: {},
  isStoreConfigured: () => true,
  getStore: () => ({
    ready: async () => {},
    collections: () => ({
      toolCallLinks: {
        ...fakeCollection(() => state.links),
        find: (filter: Document) => ({
          toArray: async () => {
            if (state.failLinkReads) throw new Error('link store unavailable');
            return structuredClone(state.links.filter(link => matches(link, filter)));
          }
        })
      },
      events: fakeCollection(
        () => state.events,
        () => state.eventWrites++
      )
    })
  })
}));

vi.mock('@mtsrc/agent-tracking-module-records', () => ({
  recordReadbackService: { isAvailable: () => false, list: async () => [] },
  toRecordDocument: () => null
}));

vi.mock('../src/queues/sessionSettle', () => ({
  queueSessionSettle: async (sessionKeys: string[]) => {
    if (sessionKeys.length) state.settled.push(sessionKeys);
  }
}));

let scope = {
  organizationId: 'ator_1',
  projectId: 'atpr_1',
  instanceId: 'atin_1',
  recordRetentionDays: 90
};

let session = {
  _id: 'session-1',
  organizationId: scope.organizationId,
  instanceId: scope.instanceId
};

let calledAt = new Date('2026-11-27T10:00:00Z');

let now = new Date('2026-11-27T10:05:00Z');

let link = (
  toolCallId: string,
  metorial: Partial<ToolCallLinkInput['metorial']> = {}
): ToolCallLinkInput => ({
  clientFamily: 'claude-code',
  toolCallId,
  calledAt,
  metorial: {
    toolCallId: `tcal_${toolCallId}`,
    providerId: 'pro_1',
    toolKey: 'search',
    ...metorial
  }
});

let toolCallEvent = (d: {
  toolCallId: string;
  id?: string;
  sessionKey?: string;
  organizationId?: string;
  instanceId?: string;
}) => ({
  ...summaryRecord({
    type: 'tool.call',
    at: '2026-11-27T10:00:00Z',
    id: d.id,
    ctx: { sessionKey: d.sessionKey ?? session._id, toolCallId: d.toolCallId },
    data: { tool: { kind: 'mcp', name: 'mcp__linear__search', mcp: { server: 'linear' } } }
  }),
  organizationId: d.organizationId ?? session.organizationId,
  instanceId: d.instanceId ?? session.instanceId
});

let settle = async (sessionKey = session._id) => {
  let settling = { ...session, _id: sessionKey };
  let records = state.events.filter(
    event =>
      event.organizationId == settling.organizationId && event.ctx.sessionKey == sessionKey
  );
  let aggregate = await aggregateSession({
    records: structuredClone(records) as SummaryRecord[],
    family: 'claude-code',
    catalog: null
  });
  let { links, metorial, staleSessionKeys } = await resolveSessionToolCallLinks({
    session: settling,
    calls: aggregate.mcpToolCalls,
    strict: true
  });

  let writes = await applyToolCallLinks({
    session: { ...settling, context: { repoIds: state.repoIds[sessionKey] ?? [] } as never },
    calls: aggregate.mcpToolCalls,
    links,
    toolCallRepoIds: aggregate.toolCallRepoIds,
    staleSessionKeys
  });

  return { summary: metorial, links, writes };
};

let stamps = () => state.events.map(event => event.metorial?.toolCallId ?? null);

let toolKeys = () => state.events.map(event => event.metorial?.toolKey ?? null);

describe('tool call links', () => {
  beforeEach(() => {
    state.links = [];
    state.events = [];
    state.settled = [];
    state.eventWrites = 0;
    state.failLinkReads = false;
    state.repoIds = {};
  });

  it('takes the link back from a stamped session once a second session shares the pair', async () => {
    state.events.push(toolCallEvent({ toolCallId: 'toolu_1', id: 'rec_a' }));
    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    await settle();
    expect(stamps()).toEqual(['tcal_toolu_1']);
    expect(state.settled).toEqual([]);

    state.events.push(
      toolCallEvent({ toolCallId: 'toolu_1', id: 'rec_b', sessionKey: 'session-2' })
    );

    let second = await settle('session-2');
    expect(second.summary).toBeUndefined();
    expect(stamps()).toEqual(['tcal_toolu_1', null]);
    expect(state.settled).toEqual([['session-1']]);

    let first = await settle(state.settled.shift()![0]);
    expect(first.summary).toBeUndefined();
    expect(stamps()).toEqual([null, null]);

    await settle('session-2');
    expect(state.settled).toEqual([]);
  });

  it('gives every tool call the repository of a session with exactly one', async () => {
    state.repoIds['session-1'] = ['aten_repo_a'];
    state.events.push(toolCallEvent({ toolCallId: 'toolu_1', id: 'rec_a' }));
    await settle();
    expect(state.events.map(event => event.attribution?.repoId)).toEqual(['aten_repo_a']);

    state.events.push(toolCallEvent({ toolCallId: 'toolu_2', id: 'rec_b' }));
    await settle();
    expect(state.events.map(event => event.attribution?.repoId)).toEqual([
      'aten_repo_a',
      'aten_repo_a'
    ]);

    let writes = state.eventWrites;
    expect((await settle()).writes).toBe(0);
    expect(state.eventWrites).toBe(writes);

    state.repoIds['session-1'] = ['aten_repo_b'];
    await settle();
    expect(state.events.map(event => event.attribution?.repoId)).toEqual([
      'aten_repo_b',
      'aten_repo_b'
    ]);

    state.repoIds['session-1'] = ['aten_repo_a', 'aten_repo_b'];
    await settle();
    expect(state.events.map(event => event.attribution?.repoId)).toEqual([
      undefined,
      undefined
    ]);

    writes = state.eventWrites;
    await settle();
    expect(state.eventWrites).toBe(writes);
  });

  it('leaves the repository of other sessions and of non-tool records alone', async () => {
    state.repoIds['session-1'] = ['aten_repo_a'];
    state.events.push(
      toolCallEvent({ toolCallId: 'toolu_1', id: 'rec_a' }),
      toolCallEvent({ toolCallId: 'toolu_2', id: 'rec_b', sessionKey: 'session-2' }),
      { ...toolCallEvent({ toolCallId: 'toolu_3', id: 'rec_c' }), type: 'session.context' }
    );

    await settle();

    expect(state.events.map(event => event.attribution?.repoId)).toEqual([
      'aten_repo_a',
      undefined,
      undefined
    ]);
  });

  it('links nothing for a pair with more records than one call can have', async () => {
    for (let index = 0; index < 9; index++) {
      state.events.push(toolCallEvent({ toolCallId: 'toolu_1', id: `rec_${index}` }));
    }

    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });

    expect((await settle()).summary).toBeUndefined();
    expect(stamps().every(stamp => stamp === null)).toBe(true);
  });

  it('carries no tool key while Detailed Tool Reporting is off and fills it in later', async () => {
    state.events.push(toolCallEvent({ toolCallId: 'toolu_1' }));
    let withoutKey = link('toolu_1');
    delete withoutKey.metorial.toolKey;

    await writeToolCallLinks({ scope, links: [withoutKey], now });
    let off = await settle();

    expect(state.links[0]!.metorial).not.toHaveProperty('toolKey');
    expect(state.events[0]!.metorial).toEqual({
      toolCallId: 'tcal_toolu_1',
      providerId: 'pro_1'
    });
    expect(off.summary).toEqual({ providerIds: ['pro_1'], toolKeys: [] });

    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    let on = await settle();

    expect(state.links[0]).not.toHaveProperty('conflict');
    expect(state.links[0]!.metorial.toolKey).toBe('search');
    expect(toolKeys()).toEqual(['search']);
    expect(on.summary).toEqual({ providerIds: ['pro_1'], toolKeys: ['search'] });

    await writeToolCallLinks({
      scope,
      links: [link('toolu_1', { toolCallId: 'tcal_other' })],
      now
    });
    expect(state.links[0]).toMatchObject({ conflict: true });
  });

  it('keeps the earlier integrations when links cannot be read for a summary', async () => {
    state.events.push(toolCallEvent({ toolCallId: 'toolu_1' }));
    state.failLinkReads = true;

    let previous = { providerIds: ['pro_1'], toolKeys: [] };
    let calls = [
      {
        clientFamily: 'claude-code',
        toolCallId: 'toolu_1',
        stamped: false,
        unstamped: true,
        missingToolKey: false
      }
    ];

    expect(
      await resolveSessionToolCallLinks({
        session: { ...session, summary: { metorial: previous } as never },
        calls
      })
    ).toEqual({ links: [], metorial: previous, staleSessionKeys: [] });
    expect(await resolveSessionToolCallLinks({ session, calls })).toEqual({
      links: [],
      metorial: undefined,
      staleSessionKeys: []
    });
    await expect(
      resolveSessionToolCallLinks({ session, calls, strict: true })
    ).rejects.toThrow('link store unavailable');
  });

  it('clamps the client family that goes into the link id', async () => {
    let family = 'f'.repeat(300);
    await writeToolCallLinks({
      scope,
      links: [{ ...link('toolu_1'), clientFamily: family }],
      now
    });

    expect(state.links[0]!.clientFamily).toHaveLength(256);
    expect(state.links[0]!._id).toBe(`atin_1:${'f'.repeat(256)}:toolu_1`);
  });

  it('stamps records that arrived before the link once the session settles again', async () => {
    state.events.push(toolCallEvent({ toolCallId: 'toolu_1' }));
    expect((await settle()).summary).toBeUndefined();

    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    let settled = await settle();

    expect(stamps()).toEqual(['tcal_toolu_1']);
    expect(state.events[0]!.metorial).toEqual({
      toolCallId: 'tcal_toolu_1',
      providerId: 'pro_1',
      toolKey: 'search'
    });
    expect(settled.summary).toEqual({ providerIds: ['pro_1'], toolKeys: ['search'] });
  });

  it('stamps records that arrive after the link, and leaves stamped ones alone', async () => {
    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });

    state.events.push(toolCallEvent({ toolCallId: 'toolu_1' }));
    await settle();
    expect(stamps()).toEqual(['tcal_toolu_1']);

    let writes = state.eventWrites;
    await settle();
    expect(state.eventWrites).toBe(writes);
  });

  it('stores a pair two Metorial calls claim as a conflict that stamps nothing', async () => {
    state.events.push(toolCallEvent({ toolCallId: 'toolu_1' }));
    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    await settle();
    expect(stamps()).toEqual(['tcal_toolu_1']);

    await writeToolCallLinks({
      scope,
      links: [link('toolu_1', { toolCallId: 'tcal_other', providerId: 'pro_2' })],
      now
    });
    let settled = await settle();

    expect(state.links).toHaveLength(1);
    expect(state.links[0]).toMatchObject({ conflict: true });
    expect(state.links[0]).not.toHaveProperty('metorial');
    expect(stamps()).toEqual([null]);
    expect(settled.summary).toBeUndefined();

    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    expect(state.links[0]).toMatchObject({ conflict: true });
    expect(state.links[0]).not.toHaveProperty('metorial');
  });

  it('treats two Metorial calls for one pair in the same batch as a conflict', async () => {
    await writeToolCallLinks({
      scope,
      links: [link('toolu_1'), link('toolu_1', { toolCallId: 'tcal_other' })],
      now
    });

    expect(state.links).toEqual([expect.objectContaining({ conflict: true })]);
  });

  it('changes nothing when the same link is pushed again', async () => {
    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    let first = structuredClone(state.links);

    await writeToolCallLinks({
      scope,
      links: [link('toolu_1')],
      now: new Date('2026-11-28T00:00:00Z')
    });

    expect(state.links).toEqual(first);
  });

  it('clamps ids the way ingest does, so overlong ids still meet their records', async () => {
    let long = `toolu_${'x'.repeat(400)}`;
    state.events.push(toolCallEvent({ toolCallId: long.slice(0, 256) }));

    await writeToolCallLinks({
      scope,
      links: [link(long, { toolCallId: `tcal_${'y'.repeat(400)}`, toolKey: 'k'.repeat(300) })],
      now
    });
    await settle();

    expect(state.links[0]!.toolCallId).toHaveLength(256);
    expect(state.links[0]!._id).toBe(
      toolCallLinkId({ instanceId: 'atin_1', clientFamily: 'claude-code', toolCallId: long })
    );
    expect(state.links[0]!.metorial.toolCallId).toHaveLength(256);
    expect(state.links[0]!.metorial.toolKey).toHaveLength(256);
    expect(state.events[0]!.metorial?.toolKey).toHaveLength(256);
  });

  it('expires a link with the records of its instance and skips one already expired', async () => {
    await writeToolCallLinks({
      scope,
      links: [
        link('toolu_1'),
        { ...link('toolu_2'), calledAt: new Date('2026-01-01T00:00:00Z') }
      ],
      now
    });

    expect(state.links).toHaveLength(1);
    expect(state.links[0]!.expiresAt).toEqual(new Date('2027-02-25T10:00:00Z'));
  });

  it("never stamps from another organization's or instance's link", async () => {
    state.events.push(toolCallEvent({ toolCallId: 'toolu_1' }));

    await writeToolCallLinks({
      scope: { ...scope, instanceId: 'atin_2' },
      links: [link('toolu_1')],
      now
    });
    await writeToolCallLinks({
      scope: { ...scope, organizationId: 'ator_2' },
      links: [link('toolu_1', { toolCallId: 'tcal_org_2' })],
      now
    });
    await writeToolCallLinks({
      scope,
      links: [{ ...link('toolu_1', { toolCallId: 'tcal_codex' }), clientFamily: 'codex' }],
      now
    });

    let settled = await settle();

    expect(stamps()).toEqual([null]);
    expect(settled.links).toEqual([]);
  });

  it("only stamps the records of the settling session's instance", async () => {
    state.events.push(
      toolCallEvent({ toolCallId: 'toolu_1' }),
      toolCallEvent({ toolCallId: 'toolu_1', instanceId: 'atin_2' })
    );

    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    await settle();

    expect(stamps()).toEqual(['tcal_toolu_1', null]);
  });

  it('collects the providers and tools used as sorted sets with a bound', async () => {
    await writeToolCallLinks({
      scope,
      links: [
        link('toolu_1', { providerId: 'pro_b', toolKey: 'search' }),
        link('toolu_2', { providerId: 'pro_a', toolKey: 'create' }),
        link('toolu_3', { providerId: 'pro_b', toolKey: 'search' })
      ],
      now
    });
    state.events.push(
      toolCallEvent({ toolCallId: 'toolu_1' }),
      toolCallEvent({ toolCallId: 'toolu_2' }),
      toolCallEvent({ toolCallId: 'toolu_3' })
    );

    expect((await settle()).summary).toEqual({
      providerIds: ['pro_a', 'pro_b'],
      toolKeys: ['create', 'search']
    });

    let many = Array.from({ length: maxSummaryMetorialIds + 5 }, (_, index) => ({
      ...state.links[0]!,
      metorial: { ...state.links[0]!.metorial, providerId: `pro_${1000 + index}` }
    }));
    expect(metorialSummaryOf(many as ToolCallLinkDocument[])!.providerIds).toHaveLength(
      maxSummaryMetorialIds
    );
  });

  it('ignores tool calls that are not MCP calls', async () => {
    state.events.push({
      ...toolCallEvent({ toolCallId: 'toolu_1' }),
      data: { tool: { kind: 'builtin', name: 'Bash' } }
    });

    await writeToolCallLinks({ scope, links: [link('toolu_1')], now });
    await settle();

    expect(stamps()).toEqual([null]);
  });
});

describe('toolCallLinkService.upsertToolCallLinks', () => {
  let organization = { id: 'ator_1' } as Organization;

  let instance = {
    id: 'atin_1',
    recordRetentionDays: 90,
    project: { id: 'atpr_1' } as Project
  } as Instance & { project: Project };

  beforeEach(() => {
    state.links = [];
    state.events = [];
    state.settled = [];
  });

  it('stores the links and settles the sessions their calls belong to', async () => {
    state.events.push(
      toolCallEvent({ toolCallId: 'toolu_1', id: 'rec_a' }),
      toolCallEvent({ toolCallId: 'toolu_2', id: 'rec_b', sessionKey: 'session-2' }),
      toolCallEvent({ toolCallId: 'toolu_3', id: 'rec_c', instanceId: 'atin_2' })
    );

    let result = await toolCallLinkService.upsertToolCallLinks({
      organization,
      instance,
      links: [
        { ...link('toolu_1'), calledAt: new Date() },
        { ...link('toolu_2'), calledAt: new Date() },
        { ...link('toolu_3'), calledAt: new Date() }
      ]
    });

    expect(result.written).toBe(3);
    expect(state.links.map(stored => stored.projectId)).toEqual([
      'atpr_1',
      'atpr_1',
      'atpr_1'
    ]);
    expect(state.settled).toEqual([['session-1', 'session-2']]);
  });

  it('refuses more than 200 links in one call', async () => {
    let links = Array.from({ length: 201 }, (_, index) => link(`toolu_${index}`));

    await expect(
      toolCallLinkService.upsertToolCallLinks({ organization, instance, links })
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(state.links).toEqual([]);
  });

  it('does nothing for an empty batch', async () => {
    expect(
      await toolCallLinkService.upsertToolCallLinks({ organization, instance, links: [] })
    ).toEqual({ written: 0, sessionKeys: [] });
    expect(state.settled).toEqual([]);
  });
});
