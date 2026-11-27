import { closeRedis } from '@mtsrc/agent-tracking-redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { settleSession } from '../src/lib/settle';
import { toolCallLinkService } from '../src/services/toolCallLink';
import { createSessionHarness, minutesAfter, store } from './harness';

let linear = {
  name: 'mcp__linear__create_issue',
  kind: 'mcp',
  class: 'mcp',
  mcp: { server: 'linear', tool: 'create_issue' }
};

type Harness = Awaited<ReturnType<typeof createSessionHarness>>;

let upsert = (harness: Harness, toolCallId: string, providerId: string) =>
  toolCallLinkService.upsertToolCallLinks({
    organization: harness.scope.organization,
    instance: { ...harness.scope.instance, project: harness.scope.project },
    links: [
      {
        clientFamily: 'claude-code',
        toolCallId,
        calledAt: new Date(),
        metorial: { toolCallId: `tcal_${crypto.randomUUID()}`, providerId, toolKey: 'create' }
      }
    ]
  });

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
