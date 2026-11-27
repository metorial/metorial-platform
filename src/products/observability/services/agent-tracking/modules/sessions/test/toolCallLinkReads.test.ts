import type { Instance, Organization, Project } from '@mtsrc/agent-tracking-db';
import { buildDraft, unitPrincipal } from '@mtsrc/agent-tracking-dialects/test/build';
import { createMemorySink, setRecordSink } from '@mtsrc/agent-tracking-module-records';
import type { ToolCallLinkDocument } from '@mtsrc/agent-tracking-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSessionToolCallLinks, toolCallLinkId } from '../src/lib/toolCallLinks';
import { toolCallLinkService } from '../src/services/toolCallLink';

let state = vi.hoisted(() => ({
  links: [] as Record<string, unknown>[],
  failLinkReads: false,
  settled: [] as string[][]
}));

vi.mock('../src/lib/collections', async () => {
  let { matchesFilter } = await import('../src/lib/filter');

  return {
    collections: async () => ({
      toolCallLinks: {
        find: (filter: Record<string, unknown>) => ({
          toArray: async () => {
            if (state.failLinkReads) throw new Error('link store unavailable');
            return state.links.filter(link => matchesFilter(link, filter));
          }
        }),
        bulkWrite: async () => ({})
      }
    })
  };
});

vi.mock('../src/queues/sessionSettle', () => ({
  queueSessionSettle: async (sessionKeys: string[]) => {
    if (sessionKeys.length) state.settled.push(sessionKeys);
  }
}));

vi.mock('@mtsrc/agent-tracking-store', async importOriginal => ({
  ...(await importOriginal<typeof import('@mtsrc/agent-tracking-store')>()),
  isStoreConfigured: () => true
}));

let principal = unitPrincipal();

let session = {
  _id: 'session-1',
  organizationId: principal.organization.id,
  instanceId: principal.instance.id
};

let calledAt = new Date('2026-11-27T10:00:00Z');

let call = {
  clientFamily: 'claude-code',
  toolCallId: 'toolu_1',
  stamped: false,
  unstamped: true,
  missingToolKey: false
};

let storedLink = (organizationId: string, providerId: string) => ({
  _id: toolCallLinkId({ instanceId: session.instanceId, ...call }),
  organizationId,
  projectId: principal.project.id,
  instanceId: session.instanceId,
  clientFamily: call.clientFamily,
  toolCallId: call.toolCallId,
  metorial: { toolCallId: `tcal_${providerId}`, providerId, calledAt },
  createdAt: calledAt,
  expiresAt: calledAt
});

let sink = createMemorySink();

let toolCall = (toolCallId: string, sessionId: string, instanceId = principal.instance.id) =>
  buildDraft(
    {
      kind: 'event',
      type: 'tool.call',
      identity: crypto.randomUUID(),
      occurredAt: calledAt,
      client: { family: 'claude-code' },
      ctx: { sessionId, toolCallId },
      data: { tool: { name: 'mcp__linear__search', kind: 'mcp', class: 'mcp' } }
    },
    { principal: { ...principal, instance: { ...principal.instance, id: instanceId } } }
  );

let store = async (instanceId: string, ...records: ReturnType<typeof toolCall>[]) =>
  await sink.write({
    lane: 'live',
    organizationId: principal.organization.id,
    projectId: principal.project.id,
    instanceId,
    records
  } as never);

beforeEach(() => {
  state.links = [];
  state.failLinkReads = false;
  state.settled = [];
  sink.clear();
  setRecordSink(sink);
});

afterEach(() => {
  setRecordSink(undefined);
});

describe('resolveSessionToolCallLinks', () => {
  it('keeps the previous summary when links cannot be read, and throws when strict', async () => {
    state.failLinkReads = true;
    let previous = { providerIds: ['pro_1'], toolKeys: [] };

    expect(
      await resolveSessionToolCallLinks({
        session: { ...session, summary: { metorial: previous } as never },
        calls: [call]
      })
    ).toEqual({ links: [], metorial: previous, staleSessionKeys: [] });
    expect(await resolveSessionToolCallLinks({ session, calls: [call] })).toEqual({
      links: [],
      metorial: undefined,
      staleSessionKeys: []
    });
    await expect(
      resolveSessionToolCallLinks({ session, calls: [call], strict: true })
    ).rejects.toThrow('link store unavailable');
  });

  it("never takes another organization's link for the same pair", async () => {
    state.links = [storedLink('ator_other', 'pro_other')];

    let other = await resolveSessionToolCallLinks({ session, calls: [call], strict: true });
    expect(other).toEqual({ links: [], metorial: undefined, staleSessionKeys: [] });

    state.links.push(storedLink(session.organizationId, 'pro_own'));

    let own = await resolveSessionToolCallLinks({ session, calls: [call], strict: true });
    expect((own.links as ToolCallLinkDocument[]).map(link => link.organizationId)).toEqual([
      session.organizationId
    ]);
    expect(own.metorial).toEqual({ providerIds: ['pro_own'], toolKeys: [] });
  });
});

describe('toolCallLinkService.upsertToolCallLinks', () => {
  let organization = { id: principal.organization.id } as Organization;

  let instance = {
    id: principal.instance.id,
    recordRetentionDays: 90,
    project: { id: principal.project.id } as Project
  } as Instance & { project: Project };

  let link = (toolCallId: string) => ({
    clientFamily: 'claude-code',
    toolCallId,
    calledAt: new Date(),
    metorial: { toolCallId: `tcal_${toolCallId}`, providerId: 'pro_1' }
  });

  it('queues a settle for the sessions the linked calls belong to, in this instance only', async () => {
    let first = toolCall('toolu_1', 's-1');
    let second = toolCall('toolu_2', 's-2');
    await store(principal.instance.id, first, second);
    await store('atin_other', toolCall('toolu_3', 's-3', 'atin_other'));

    let result = await toolCallLinkService.upsertToolCallLinks({
      organization,
      instance,
      links: [link('toolu_1'), link('toolu_2'), link('toolu_3')]
    });

    let expected = [first.ctx.session_key!, second.ctx.session_key!].sort();
    expect(result).toEqual({ written: 3, sessionKeys: expect.any(Array) });
    expect([...result.sessionKeys].sort()).toEqual(expected);
    expect(state.settled.map(keys => [...keys].sort())).toEqual([expected]);
  });

  it('refuses more than 200 links in one call and queues nothing for none', async () => {
    await expect(
      toolCallLinkService.upsertToolCallLinks({
        organization,
        instance,
        links: Array.from({ length: 201 }, (_, index) => link(`toolu_${index}`))
      })
    ).rejects.toMatchObject({ data: { status: 400 } });

    expect(
      await toolCallLinkService.upsertToolCallLinks({ organization, instance, links: [] })
    ).toEqual({ written: 0, sessionKeys: [] });
    expect(state.settled).toEqual([]);
  });
});
