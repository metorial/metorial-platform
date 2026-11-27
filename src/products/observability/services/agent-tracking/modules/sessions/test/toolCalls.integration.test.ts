import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeRedis } from '@mtsrc/agent-tracking-redis';
import { sessionToolCallService } from '../src/services/sessionToolCall';
import { sessionMcpToolCallFilter, toolCallLookupFilter } from '../src/lib/records';
import { createSessionHarness, minutesAfter, store } from './harness';

let linear = {
  name: 'mcp__linear__create_issue',
  kind: 'mcp',
  class: 'mcp',
  mcp: { server: 'linear', tool: 'create_issue' }
};

let shell = { name: 'Bash', kind: 'shell', class: 'shell' };

let planNodes = (plan: unknown): Record<string, unknown>[] => {
  if (!plan || typeof plan != 'object') return [];

  let node = plan as Record<string, unknown>;
  let children = [node.inputStage, node.queryPlan, ...((node.inputStages as unknown[]) ?? [])];

  return [node, ...children.flatMap(planNodes)];
};

let winningPlan = (explained: unknown) =>
  (explained as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan;

let planStages = (explained: unknown) =>
  planNodes(winningPlan(explained)).map(node => node.stage);

let indexScans = (explained: unknown) =>
  planNodes(winningPlan(explained))
    .filter(node => node.stage == 'IXSCAN')
    .map(node => node.indexName);

beforeAll(async () => {
  await store.ready();
  await store.ensureIndexes();
});

afterAll(async () => {
  await closeRedis();
});

describe('session tool calls', () => {
  it("lists a session's MCP tool calls once per call from the record store", async () => {
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);
    let sessionId = `tools-${crypto.randomUUID()}`;

    let [first] = await harness.ingest([
      {
        type: 'tool.decision',
        at: start,
        sessionId,
        ctx: { toolCallId: 'toolu_a' },
        data: { tool: linear, decision: { value: 'allow' } }
      },
      {
        type: 'tool.call',
        at: minutesAfter(start, 1),
        sessionId,
        ctx: { toolCallId: 'toolu_a' },
        data: { tool: linear, outcome: 'ok', duration_ms: 320 }
      },
      {
        type: 'tool.call',
        at: minutesAfter(start, 1),
        sessionId,
        role: 'duplicate',
        channel: 'otlp.traces',
        ctx: { toolCallId: 'toolu_a' },
        data: { tool: linear, outcome: 'ok' }
      },
      {
        type: 'tool.call',
        at: minutesAfter(start, 2),
        sessionId,
        ctx: { toolCallId: 'toolu_shell' },
        data: { tool: shell, outcome: 'ok' }
      },
      {
        type: 'tool.call',
        at: minutesAfter(start, 3),
        sessionId,
        data: { tool: linear, outcome: 'ok' }
      },
      {
        type: 'tool.call',
        at: minutesAfter(start, 4),
        sessionId,
        ctx: { toolCallId: 'toolu_b' },
        data: { tool: { name: 'mcp_tool', kind: 'unknown', class: 'other' }, outcome: 'error' }
      }
    ]);

    let result = await sessionToolCallService.listSessionMcpToolCalls({
      organization: harness.scope.organization,
      sessionKey: first!.ctx.session_key!
    });

    expect(result.hasMore).toBe(false);
    expect(result.items).toEqual([
      {
        clientFamily: 'claude-code',
        toolCallId: 'toolu_a',
        occurredAt: minutesAfter(start, 1),
        durationMs: 320,
        outcome: 'ok',
        mcpServer: 'linear',
        mcpTool: 'create_issue'
      },
      expect.objectContaining({ toolCallId: 'toolu_b', outcome: 'error', mcpServer: null })
    ]);
  });

  it('finds the session of an id within the organization and instance', async () => {
    let harness = await createSessionHarness();
    let other = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);
    let toolCallId = `toolu_${crypto.randomUUID()}`;
    let reused = `call_${crypto.randomUUID()}`;

    let call = (sessionId: string, id: string, family?: string) => ({
      type: 'tool.call',
      at: start,
      sessionId,
      family,
      ctx: { toolCallId: id },
      data: { tool: linear, outcome: 'ok' }
    });

    let [own] = await harness.ingest([call(`own-${crypto.randomUUID()}`, toolCallId)]);
    await harness.ingest([call(`codex-${crypto.randomUUID()}`, toolCallId, 'codex')]);
    await harness.ingest([call(`first-${crypto.randomUUID()}`, reused)]);
    await harness.ingest([call(`second-${crypto.randomUUID()}`, reused)]);
    await other.ingest([call(`other-${crypto.randomUUID()}`, toolCallId)]);

    let result = await sessionToolCallService.findSessionsForToolCalls({
      organization: harness.scope.organization,
      instance: harness.scope.instance,
      calls: [
        { clientFamily: 'claude-code', toolCallId },
        { clientFamily: 'claude-code', toolCallId },
        { clientFamily: 'claude-code', toolCallId: reused },
        { clientFamily: 'claude-code', toolCallId: 'toolu_unknown' }
      ]
    });

    expect(result.items).toEqual([
      {
        sessionKey: own!.ctx.session_key,
        clientFamily: 'claude-code',
        toolCallId,
        occurredAt: start
      }
    ]);
    expect(result.ambiguous).toEqual([{ clientFamily: 'claude-code', toolCallId: reused }]);
    expect(result.sessions.map(session => session._id)).toEqual([own!.ctx.session_key]);
  });

  it('serves both reads from indexes without a blocking sort', async () => {
    let harness = await createSessionHarness();
    let events = store.collections().events;

    let indexes = await events.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({
        key: { organizationId: 1, instanceId: 1, 'ctx.toolCallId': 1, 'client.family': 1 },
        partialFilterExpression: { 'ctx.toolCallId': { $exists: true } }
      })
    );

    let lookup = await events
      .find(
        toolCallLookupFilter({
          organizationId: harness.scope.organization.id,
          instanceId: harness.scope.instance.id,
          call: { clientFamily: 'claude-code', toolCallId: 'toolu_explain' }
        }),
        { limit: 9 }
      )
      .explain('queryPlanner');

    expect(indexScans(lookup)).toContain(
      'organizationId_1_instanceId_1_ctx.toolCallId_1_client.family_1'
    );

    let session = await events
      .find(
        sessionMcpToolCallFilter({
          organizationId: harness.scope.organization.id,
          sessionKey: 'session-explain'
        })
      )
      .sort({ occurredAt: 1 })
      .explain('queryPlanner');

    expect(indexScans(session)).toContain('organizationId_1_ctx.sessionKey_1_occurredAt_1');
    expect(planStages(session)).not.toContain('SORT');
  });
});
