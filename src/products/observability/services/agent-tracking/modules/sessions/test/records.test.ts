import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemorySink, setRecordSink } from '@mtsrc/agent-tracking-module-records';
import { buildDraft, unitPrincipal } from '@mtsrc/agent-tracking-dialects/test/build';
import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import {
  sessionHasMeasurements,
  sessionMcpToolCallRecords,
  toolCallPairReader,
  toolCallRecordReader
} from '../src/lib/records';

let principal = unitPrincipal();
let scope = { organizationId: principal.organization.id, instanceId: principal.instance.id };
let at = new Date('2026-06-15T11:00:00Z');

let linear = { name: 'mcp__linear__search', kind: 'mcp', class: 'mcp' };

let toolCall = (d: {
  toolCallId?: string;
  sessionId?: string | null;
  family?: string;
  tool?: Record<string, unknown>;
  type?: string;
}) =>
  buildDraft({
    kind: 'event',
    type: d.type ?? 'tool.call',
    identity: crypto.randomUUID(),
    occurredAt: at,
    client: { family: d.family ?? 'claude-code' },
    ctx: {
      ...(d.sessionId === null ? {} : { sessionId: d.sessionId ?? 's-1' }),
      ...(d.toolCallId ? { toolCallId: d.toolCallId } : {})
    },
    data: { tool: d.tool ?? linear, outcome: 'ok' }
  });

let measurement = (sessionId: string) =>
  buildDraft({
    kind: 'measurement',
    type: 'tokens',
    identity: crypto.randomUUID(),
    occurredAt: at,
    client: { family: 'claude-code' },
    ctx: { sessionId },
    data: { value: 3, unit: 'tokens' }
  });

let sink = createMemorySink();

let store = async (...records: NormalizedRecord[]) =>
  await sink.write({
    lane: 'live',
    organizationId: principal.organization.id,
    projectId: principal.project.id,
    instanceId: principal.instance.id,
    records
  } as never);

let sessionKeyOf = (record: NormalizedRecord) => record.ctx.session_key!;

beforeEach(() => {
  sink.clear();
  setRecordSink(sink);
});

afterEach(() => {
  setRecordSink(undefined);
});

describe('records read from the in-memory sink', () => {
  it("lists a session's MCP tool calls with an id, placeholder names included", async () => {
    let mcp = toolCall({ toolCallId: 'toolu_1' });
    let placeholder = toolCall({
      toolCallId: 'toolu_2',
      tool: { name: 'mcp_tool', kind: 'unknown', class: 'other' }
    });

    await store(
      mcp,
      placeholder,
      toolCall({
        toolCallId: 'toolu_3',
        tool: { name: 'Bash', kind: 'shell', class: 'shell' }
      }),
      toolCall({}),
      toolCall({ toolCallId: 'toolu_4', sessionId: 's-2' })
    );

    let found = await Array.fromAsync(
      await sessionMcpToolCallRecords({
        organizationId: scope.organizationId,
        sessionKey: sessionKeyOf(mcp)
      })
    );

    expect(found.map(record => record.ctx.toolCallId).sort()).toEqual(['toolu_1', 'toolu_2']);
  });

  it('looks a call up by family and id among records that belong to a session', async () => {
    await store(
      toolCall({ toolCallId: 'toolu_1' }),
      toolCall({ toolCallId: 'toolu_1', family: 'codex' }),
      toolCall({ toolCallId: 'toolu_1', sessionId: null }),
      toolCall({ toolCallId: 'toolu_2' })
    );

    let read = await toolCallRecordReader(scope);
    let found = await read({
      call: { clientFamily: 'claude-code', toolCallId: 'toolu_1' },
      limit: 10
    });

    expect(found).toHaveLength(1);
    expect(found[0]!.client.family).toBe('claude-code');
  });

  it('reads the records of several ids of one family, bounded', async () => {
    await store(
      toolCall({ toolCallId: 'toolu_1' }),
      toolCall({ toolCallId: 'toolu_2', sessionId: 's-2' }),
      toolCall({ toolCallId: 'toolu_2', family: 'codex' }),
      toolCall({ toolCallId: 'toolu_3' })
    );

    let read = await toolCallPairReader(scope);

    expect(
      (
        await read({
          clientFamily: 'claude-code',
          toolCallIds: ['toolu_1', 'toolu_2'],
          limit: 10
        })
      )
        .map(record => record.ctx.toolCallId)
        .sort()
    ).toEqual(['toolu_1', 'toolu_2']);
    expect(
      await read({
        clientFamily: 'claude-code',
        toolCallIds: ['toolu_1', 'toolu_2'],
        limit: 1
      })
    ).toHaveLength(1);
  });

  it('tells whether a session has a measurement', async () => {
    let first = measurement('s-1');
    await store(first, measurement('s-2'));

    let session = (sessionKey: string) =>
      ({ _id: sessionKey, ...scope, startedAt: at, lastActivityAt: at }) as SessionDocument;

    expect(await sessionHasMeasurements(session(sessionKeyOf(first)))).toBe(true);
    expect(await sessionHasMeasurements(session('session-without-any'))).toBe(false);
  });
});
