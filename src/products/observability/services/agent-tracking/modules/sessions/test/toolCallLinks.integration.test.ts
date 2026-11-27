import { closeRedis } from '@mtsrc/agent-tracking-redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { settleSession } from '../src/lib/settle';
import { copySessionRepoToToolCalls } from '../src/lib/toolCallRepos';
import { toolCallLinkService } from '../src/services/toolCallLink';
import { createSessionHarness, minutesAfter, store } from './harness';

let linear = {
  name: 'mcp__linear__create_issue',
  kind: 'mcp',
  class: 'mcp',
  mcp: { server: 'linear', tool: 'create_issue' }
};

type Harness = Awaited<ReturnType<typeof createSessionHarness>>;

let linkTo = (
  toolCallId: string,
  metorial: { toolCallId?: string; providerId?: string; toolKey?: string | null } = {}
) => {
  let { toolKey = 'create', ...target } = metorial;

  return {
    clientFamily: 'claude-code',
    toolCallId,
    calledAt: new Date(),
    metorial: {
      toolCallId: `tcal_${crypto.randomUUID()}`,
      providerId: 'pro_a',
      ...target,
      ...(toolKey ? { toolKey } : {})
    }
  };
};

let upsertLinks = (harness: Harness, links: ReturnType<typeof linkTo>[]) =>
  toolCallLinkService.upsertToolCallLinks({
    organization: harness.scope.organization,
    instance: { ...harness.scope.instance, project: harness.scope.project },
    links
  });

let upsert = (harness: Harness, toolCallId: string, providerId: string) =>
  upsertLinks(harness, [linkTo(toolCallId, { providerId })]);

let storedLink = async (harness: Harness, toolCallId: string) =>
  await harness.collections().toolCallLinks.findOne({
    instanceId: harness.scope.instance.id,
    toolCallId
  });

let callRecords = (sessionId: string, toolCallId: string, count = 1, tool = linear) =>
  Array.from({ length: count }, (_, index) => ({
    type: 'tool.call',
    at: new Date(Date.now() - (60 - index) * 1000),
    sessionId,
    ctx: { toolCallId },
    data: { tool, outcome: 'ok' }
  }));

let stamped = async (harness: Harness, sessionKey: string) =>
  (
    await harness
      .collections()
      .events.find({
        organizationId: harness.scope.organization.id,
        'ctx.sessionKey': sessionKey,
        type: 'tool.call'
      })
      .toArray()
  ).map(event => event.metorial?.providerId ?? null);

beforeAll(async () => {
  await store.ready();
  await store.ensureIndexes();
});

afterAll(async () => {
  await closeRedis();
});

describe('tool call links', () => {
  it('stamps the calls and the summary whichever of link and records came first', async () => {
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);
    let sessionId = `links-${crypto.randomUUID()}`;
    let early = `toolu_${crypto.randomUUID()}`;
    let late = `toolu_${crypto.randomUUID()}`;

    await upsert(harness, early, 'pro_a');

    let [first] = await harness.ingest([
      {
        type: 'tool.call',
        at: start,
        sessionId,
        ctx: { toolCallId: early },
        data: { tool: linear, outcome: 'ok' }
      },
      {
        type: 'tool.call',
        at: minutesAfter(start, 1),
        sessionId,
        ctx: { toolCallId: late },
        data: { tool: linear, outcome: 'ok' }
      }
    ]);
    let sessionKey = first!.ctx.session_key!;

    await settleSession({ sessionKey });
    expect((await stamped(harness, sessionKey)).sort()).toEqual([null, 'pro_a']);

    let result = await upsert(harness, late, 'pro_b');
    expect(result.sessionKeys).toEqual([sessionKey]);

    await settleSession({ sessionKey });

    expect((await stamped(harness, sessionKey)).sort()).toEqual(['pro_a', 'pro_b']);
    expect((await harness.session(sessionKey))?.summary?.metorial).toEqual({
      providerIds: ['pro_a', 'pro_b'],
      toolKeys: ['create']
    });
  });

  it('takes the stamp back when a second Metorial call claims the pair', async () => {
    let harness = await createSessionHarness();
    let toolCallId = `toolu_${crypto.randomUUID()}`;

    let [record] = await harness.ingest([
      {
        type: 'tool.call',
        at: new Date(Date.now() - 60 * 1000),
        sessionId: `conflict-${crypto.randomUUID()}`,
        ctx: { toolCallId },
        data: { tool: linear, outcome: 'ok' }
      }
    ]);
    let sessionKey = record!.ctx.session_key!;

    await upsert(harness, toolCallId, 'pro_a');
    await settleSession({ sessionKey });
    expect(await stamped(harness, sessionKey)).toEqual(['pro_a']);

    await upsert(harness, toolCallId, 'pro_a');
    await settleSession({ sessionKey });

    expect(await stamped(harness, sessionKey)).toEqual([null]);
    expect((await harness.session(sessionKey))?.summary?.metorial).toBeUndefined();
  });

  it('stamps neither session when a pair occurs in two of them', async () => {
    let harness = await createSessionHarness();
    let toolCallId = `toolu_${crypto.randomUUID()}`;
    let call = (sessionId: string) => ({
      type: 'tool.call',
      at: new Date(Date.now() - 60 * 1000),
      sessionId,
      ctx: { toolCallId },
      data: { tool: linear, outcome: 'ok' }
    });

    let [one] = await harness.ingest([call(`one-${crypto.randomUUID()}`)]);
    let [two] = await harness.ingest([call(`two-${crypto.randomUUID()}`)]);

    await upsert(harness, toolCallId, 'pro_a');
    await settleSession({ sessionKey: one!.ctx.session_key! });
    await settleSession({ sessionKey: two!.ctx.session_key! });

    for (let record of [one!, two!]) {
      let sessionKey = record.ctx.session_key!;
      expect(await stamped(harness, sessionKey)).toEqual([null]);
      expect((await harness.session(sessionKey))?.summary?.metorial).toBeUndefined();
    }
  });

  it("does not stamp from another instance's link", async () => {
    let harness = await createSessionHarness();
    let other = await createSessionHarness();
    let toolCallId = `toolu_${crypto.randomUUID()}`;

    let [record] = await harness.ingest([
      {
        type: 'tool.call',
        at: new Date(Date.now() - 60 * 1000),
        sessionId: `isolated-${crypto.randomUUID()}`,
        ctx: { toolCallId },
        data: { tool: linear, outcome: 'ok' }
      }
    ]);
    let sessionKey = record!.ctx.session_key!;

    await upsert(other, toolCallId, 'pro_a');
    await settleSession({ sessionKey });

    expect(await stamped(harness, sessionKey)).toEqual([null]);
  });

  it('carries no tool key while Detailed Tool Reporting is off and fills it in later', async () => {
    let harness = await createSessionHarness();
    let toolCallId = `toolu_${crypto.randomUUID()}`;
    let metorialCall = `tcal_${crypto.randomUUID()}`;

    let [record] = await harness.ingest(callRecords(`key-${crypto.randomUUID()}`, toolCallId));
    let sessionKey = record!.ctx.session_key!;

    await upsertLinks(harness, [
      linkTo(toolCallId, { toolCallId: metorialCall, toolKey: null })
    ]);
    await settleSession({ sessionKey });

    expect((await storedLink(harness, toolCallId))?.metorial).not.toHaveProperty('toolKey');
    expect((await harness.session(sessionKey))?.summary?.metorial).toEqual({
      providerIds: ['pro_a'],
      toolKeys: []
    });

    await upsertLinks(harness, [linkTo(toolCallId, { toolCallId: metorialCall })]);
    await settleSession({ sessionKey });

    expect((await storedLink(harness, toolCallId))?.metorial?.toolKey).toBe('create');
    expect((await harness.session(sessionKey))?.summary?.metorial?.toolKeys).toEqual([
      'create'
    ]);
  });

  it('keeps one link per pair, unchanged when pushed again and a conflict for two calls', async () => {
    let harness = await createSessionHarness();
    let same = `toolu_${crypto.randomUUID()}`;
    let twice = `toolu_${crypto.randomUUID()}`;
    let first = linkTo(same);

    await upsertLinks(harness, [first]);
    let stored = await storedLink(harness, same);
    await upsertLinks(harness, [{ ...first, calledAt: new Date() }]);

    expect(await storedLink(harness, same)).toEqual(stored);

    await upsertLinks(harness, [linkTo(twice), linkTo(twice)]);

    let conflict = await storedLink(harness, twice);
    expect(conflict).toMatchObject({ conflict: true });
    expect(conflict).not.toHaveProperty('metorial');
  });

  it('links nothing for a pair with more records than one call can have', async () => {
    let harness = await createSessionHarness();
    let toolCallId = `toolu_${crypto.randomUUID()}`;

    let [record] = await harness.ingest(
      callRecords(`many-${crypto.randomUUID()}`, toolCallId, 9)
    );
    let sessionKey = record!.ctx.session_key!;

    await upsert(harness, toolCallId, 'pro_a');
    await settleSession({ sessionKey });

    expect((await stamped(harness, sessionKey)).every(stamp => stamp === null)).toBe(true);
    expect((await harness.session(sessionKey))?.summary?.metorial).toBeUndefined();
  });

  it('ignores tool calls that are not MCP calls', async () => {
    let harness = await createSessionHarness();
    let toolCallId = `toolu_${crypto.randomUUID()}`;
    let shell = { name: 'Bash', kind: 'shell', class: 'shell' } as unknown as typeof linear;

    let [record] = await harness.ingest(
      callRecords(`shell-${crypto.randomUUID()}`, toolCallId, 1, shell)
    );
    let sessionKey = record!.ctx.session_key!;

    await upsert(harness, toolCallId, 'pro_a');
    await settleSession({ sessionKey });

    expect(await stamped(harness, sessionKey)).toEqual([null]);
  });

  it('refuses more than 200 links in one call and does nothing for none', async () => {
    let harness = await createSessionHarness();

    await expect(
      upsertLinks(
        harness,
        Array.from({ length: 201 }, () => linkTo(`toolu_${crypto.randomUUID()}`))
      )
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(await upsertLinks(harness, [])).toEqual({ written: 0, sessionKeys: [] });
  });

  it("copies the session's single repository onto its tool calls only", async () => {
    let harness = await createSessionHarness();
    let sessionId = `repo-${crypto.randomUUID()}`;

    let [record] = await harness.ingest([
      ...callRecords(sessionId, `toolu_${crypto.randomUUID()}`),
      ...callRecords(`other-${crypto.randomUUID()}`, `toolu_${crypto.randomUUID()}`),
      { type: 'prompt.submitted', at: new Date(Date.now() - 30 * 1000), sessionId }
    ]);
    let sessionKey = record!.ctx.session_key!;
    let session = {
      _id: sessionKey,
      organizationId: harness.scope.organization.id,
      instanceId: harness.scope.instance.id
    };
    let repoIds = async () =>
      (
        await harness
          .collections()
          .events.find({ organizationId: harness.scope.organization.id })
          .toArray()
      )
        .map(event => [
          event.ctx.sessionKey == sessionKey,
          event.type,
          event.attribution?.repoId
        ])
        .sort();

    await copySessionRepoToToolCalls({
      session: { ...session, context: { repoIds: ['aten_repo_a'] } as never },
      repoIds: [null]
    });
    expect(await repoIds()).toEqual([
      [false, 'tool.call', undefined],
      [true, 'prompt.submitted', undefined],
      [true, 'tool.call', 'aten_repo_a']
    ]);

    await copySessionRepoToToolCalls({
      session: { ...session, context: { repoIds: ['aten_repo_a', 'aten_repo_b'] } as never },
      repoIds: ['aten_repo_a']
    });
    expect((await repoIds()).every(([, , repoId]) => repoId === undefined)).toBe(true);
  });

  it('stamps through the tool-call id index', async () => {
    let harness = await createSessionHarness();

    let explained = await harness
      .collections()
      .events.find({
        organizationId: harness.scope.organization.id,
        instanceId: harness.scope.instance.id,
        'ctx.toolCallId': 'toolu_explain',
        'client.family': 'claude-code',
        'ctx.sessionKey': 'session-explain',
        type: 'tool.call',
        metorial: { $exists: false }
      })
      .explain('queryPlanner');

    expect(JSON.stringify(explained)).toContain(
      'organizationId_1_instanceId_1_ctx.toolCallId_1_client.family_1'
    );
  });
});
