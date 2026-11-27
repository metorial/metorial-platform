import { describe, expect, it } from 'vitest';
import type { RecordRole } from '@mtsrc/agent-tracking-spec';
import {
  clampStoredId,
  collectSessionMcpToolCalls,
  isMcpToolCall,
  resolveToolCallSessions,
  type ToolCallRecord,
  type ToolCallRecordReader,
  type ToolCallRef
} from '../src/lib/toolCalls';

let counter = 0;

let mcpTool = { name: 'mcp__linear__create_issue', kind: 'mcp', class: 'mcp' };

let linearTool = {
  ...mcpTool,
  mcp: { server: 'linear', tool: 'create_issue' }
};

let toolRecord = (d: {
  id?: string;
  type?: string;
  at: string;
  toolCallId?: string;
  sessionKey?: string;
  family?: string;
  role?: RecordRole;
  organizationId?: string;
  instanceId?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}): ToolCallRecord => ({
  _id: d.id ?? `rec_${++counter}`,
  organizationId: d.organizationId ?? 'ator_1',
  instanceId: d.instanceId ?? 'atin_1',
  type: d.type ?? 'tool.call',
  occurredAt: new Date(d.at),
  ...(d.durationMs !== undefined ? { durationMs: d.durationMs } : {}),
  source: {
    adapter: 'test',
    dialect: 'test.v1',
    channel: 'otlp.logs',
    role: d.role ?? 'primary'
  },
  client: { family: d.family ?? 'claude-code' },
  ctx: {
    sessionKey: d.sessionKey ?? 'session-1',
    ...(d.toolCallId ? { toolCallId: d.toolCallId } : {})
  },
  data: d.data ?? { tool: linearTool }
});

describe('isMcpToolCall', () => {
  it('takes MCP tool calls that carry an id', () => {
    expect(
      isMcpToolCall(toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: 'toolu_1' }))
    ).toBe(true);
  });

  it('takes a redacted call stored as an unknown tool by placeholder, for every client', () => {
    let legacy = toolRecord({
      at: '2026-11-27T10:00:00Z',
      toolCallId: 'toolu_1',
      data: { tool: { name: 'mcp_tool', kind: 'unknown', class: 'other' } }
    });

    expect(isMcpToolCall(legacy)).toBe(true);
    expect(isMcpToolCall({ ...legacy, client: { family: 'codex' } })).toBe(true);
  });

  it('leaves out other tools, calls without an id and other record types', () => {
    expect(
      isMcpToolCall(
        toolRecord({
          at: '2026-11-27T10:00:00Z',
          toolCallId: 'toolu_1',
          data: { tool: { name: 'Bash', kind: 'shell', class: 'shell' } }
        })
      )
    ).toBe(false);
    expect(isMcpToolCall(toolRecord({ at: '2026-11-27T10:00:00Z' }))).toBe(false);
    expect(
      isMcpToolCall(
        toolRecord({
          type: 'tool.decision',
          at: '2026-11-27T10:00:00Z',
          toolCallId: 'toolu_1'
        })
      )
    ).toBe(false);
  });
});

describe('collectSessionMcpToolCalls', () => {
  it('returns one entry per call when a decision, a log and a span share an id', async () => {
    let records = [
      toolRecord({
        type: 'tool.decision',
        at: '2026-11-27T10:00:00Z',
        toolCallId: 'toolu_1',
        data: { tool: mcpTool, decision: { value: 'allow' } }
      }),
      toolRecord({
        at: '2026-11-27T10:00:01Z',
        toolCallId: 'toolu_1',
        role: 'duplicate',
        durationMs: 900,
        data: { tool: mcpTool, outcome: 'ok' }
      }),
      toolRecord({
        at: '2026-11-27T10:00:02Z',
        toolCallId: 'toolu_1',
        data: { tool: linearTool, outcome: 'error' }
      })
    ];

    let result = await collectSessionMcpToolCalls({ records });

    expect(result).toEqual({
      items: [
        {
          clientFamily: 'claude-code',
          toolCallId: 'toolu_1',
          occurredAt: new Date('2026-11-27T10:00:02Z'),
          durationMs: 900,
          outcome: 'error',
          mcpServer: 'linear',
          mcpTool: 'create_issue'
        }
      ],
      hasMore: false
    });
  });

  it('excludes tools that are not MCP and calls without an id', async () => {
    let records = [
      toolRecord({
        at: '2026-11-27T10:00:00Z',
        toolCallId: 'toolu_bash',
        data: { tool: { name: 'Bash', kind: 'shell', class: 'shell' } }
      }),
      toolRecord({ at: '2026-11-27T10:00:01Z' }),
      toolRecord({ at: '2026-11-27T10:00:02Z', toolCallId: 'toolu_mcp' })
    ];

    let result = await collectSessionMcpToolCalls({ records });

    expect(result.items.map(item => item.toolCallId)).toEqual(['toolu_mcp']);
  });

  it('returns calls oldest first and hides placeholder server names', async () => {
    let records = [
      toolRecord({ at: '2026-11-27T10:00:05Z', toolCallId: 'toolu_late' }),
      toolRecord({
        at: '2026-11-27T10:00:01Z',
        toolCallId: 'toolu_early',
        data: {
          tool: { ...mcpTool, mcp: { server: 'custom', tool: 'mcp_tool' } },
          durationMs: 40
        }
      })
    ];

    let result = await collectSessionMcpToolCalls({ records });

    expect(result.items.map(item => item.toolCallId)).toEqual(['toolu_early', 'toolu_late']);
    expect(result.items[0]).toMatchObject({
      mcpServer: null,
      mcpTool: 'mcp_tool',
      durationMs: 40
    });
    expect(result.items[1]).toMatchObject({ durationMs: null, outcome: null });
  });

  it('stops at the bound and says there are more', async () => {
    let records = Array.from({ length: 4 }, (_, index) =>
      toolRecord({ at: `2026-11-27T10:00:0${index}Z`, toolCallId: `toolu_${index}` })
    );
    records.push(
      toolRecord({
        at: '2026-11-27T10:00:09Z',
        toolCallId: 'toolu_1',
        role: 'duplicate',
        durationMs: 12
      })
    );

    let bounded = await collectSessionMcpToolCalls({ records, limit: 2 });

    expect(bounded.hasMore).toBe(true);
    expect(bounded.items.map(item => item.toolCallId)).toEqual(['toolu_0', 'toolu_1']);
    expect(bounded.items[1]!.durationMs).toBe(12);

    let exact = await collectSessionMcpToolCalls({ records, limit: 4 });

    expect(exact.hasMore).toBe(false);
    expect(exact.items).toHaveLength(4);
  });

  it('reads an async cursor', async () => {
    let cursor = async function* () {
      yield toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: 'toolu_1' });
    };

    let result = await collectSessionMcpToolCalls({ records: cursor() });

    expect(result.items).toHaveLength(1);
  });

  it('admits calls that share a time in a stable order', async () => {
    let at = '2026-11-27T10:00:00Z';
    let records = [
      toolRecord({ id: 'rec_c', at, toolCallId: 'toolu_c' }),
      toolRecord({ id: 'rec_a', at, toolCallId: 'toolu_a' }),
      toolRecord({ id: 'rec_b', at, toolCallId: 'toolu_b' })
    ];

    let forward = await collectSessionMcpToolCalls({ records, limit: 2 });
    let backward = await collectSessionMcpToolCalls({
      records: [...records].reverse(),
      limit: 2
    });

    expect(forward.items.map(item => item.toolCallId)).toEqual(['toolu_a', 'toolu_b']);
    expect(backward.items).toEqual(forward.items);
    expect(forward.hasMore).toBe(true);
  });

  it('stops reading once the bound is passed and the merge margin is over', async () => {
    let base = Date.parse('2026-11-27T10:00:00Z');
    let read = 0;
    let cursor = async function* () {
      for (let index = 0; index < 1000; index++) {
        read++;
        yield toolRecord({
          at: new Date(base + index * 10_000).toISOString(),
          toolCallId: `toolu_${String(index).padStart(4, '0')}`
        });
      }
    };

    let result = await collectSessionMcpToolCalls({ records: cursor(), limit: 500 });

    expect(result.items).toHaveLength(500);
    expect(result.hasMore).toBe(true);
    expect(result.items[499]!.toolCallId).toBe('toolu_0499');
    expect(read).toBeLessThanOrEqual(540);
  });

  it('merges a late record of the last admitted call inside the margin', async () => {
    let records = [
      toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: 'toolu_1', role: 'duplicate' }),
      toolRecord({ at: '2026-11-27T10:00:01Z', toolCallId: 'toolu_2' }),
      toolRecord({
        at: '2026-11-27T10:00:03Z',
        toolCallId: 'toolu_1',
        data: { tool: linearTool, outcome: 'error' }
      }),
      toolRecord({
        at: '2026-11-27T10:10:00Z',
        toolCallId: 'toolu_1',
        data: { tool: linearTool, outcome: 'ok' }
      })
    ];

    let result = await collectSessionMcpToolCalls({ records, limit: 1 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toEqual([
      expect.objectContaining({
        toolCallId: 'toolu_1',
        occurredAt: new Date('2026-11-27T10:00:03Z'),
        outcome: 'error'
      })
    ]);
  });
});

let readerOf =
  (records: ToolCallRecord[]): ToolCallRecordReader =>
  async ({ call, limit }) =>
    records
      .filter(
        document =>
          document.ctx.toolCallId == call.toolCallId &&
          document.client.family == call.clientFamily
      )
      .slice(0, limit);

describe('resolveToolCallSessions', () => {
  let scope = { organizationId: 'ator_1', instanceId: 'atin_1' };

  let resolve = (records: ToolCallRecord[], calls: ToolCallRef[]) =>
    resolveToolCallSessions({ ...scope, calls, read: readerOf(records) });

  it('finds ids across sessions, one entry per id', async () => {
    let records = [
      toolRecord({
        at: '2026-11-27T10:00:02Z',
        toolCallId: 'toolu_2',
        sessionKey: 'session-2'
      }),
      toolRecord({
        at: '2026-11-27T10:00:00Z',
        toolCallId: 'toolu_1',
        sessionKey: 'session-1'
      }),
      toolRecord({
        at: '2026-11-27T10:00:01Z',
        toolCallId: 'toolu_1',
        sessionKey: 'session-1',
        role: 'duplicate'
      })
    ];

    let result = await resolve(records, [
      { clientFamily: 'claude-code', toolCallId: 'toolu_2' },
      { clientFamily: 'claude-code', toolCallId: 'toolu_1' }
    ]);

    expect(result).toEqual({
      items: [
        {
          sessionKey: 'session-1',
          clientFamily: 'claude-code',
          toolCallId: 'toolu_1',
          occurredAt: new Date('2026-11-27T10:00:00Z')
        },
        {
          sessionKey: 'session-2',
          clientFamily: 'claude-code',
          toolCallId: 'toolu_2',
          occurredAt: new Date('2026-11-27T10:00:02Z')
        }
      ],
      ambiguous: []
    });
  });

  it("ignores another organization's or instance's records", async () => {
    let records = [
      toolRecord({
        at: '2026-11-27T10:00:00Z',
        toolCallId: 'toolu_1',
        organizationId: 'ator_2'
      }),
      toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: 'toolu_1', instanceId: 'atin_2' })
    ];

    let result = await resolve(records, [
      { clientFamily: 'claude-code', toolCallId: 'toolu_1' }
    ]);

    expect(result).toEqual({ items: [], ambiguous: [] });
  });

  it('keeps the same id under two client families apart', async () => {
    let records = [
      toolRecord({
        at: '2026-11-27T10:00:00Z',
        toolCallId: 'call_1',
        sessionKey: 'session-cc'
      }),
      toolRecord({
        at: '2026-11-27T10:00:01Z',
        toolCallId: 'call_1',
        sessionKey: 'session-codex',
        family: 'codex'
      })
    ];

    let codexOnly = await resolve(records, [{ clientFamily: 'codex', toolCallId: 'call_1' }]);

    expect(codexOnly.items).toEqual([
      expect.objectContaining({ sessionKey: 'session-codex', clientFamily: 'codex' })
    ]);

    let both = await resolve(records, [
      { clientFamily: 'codex', toolCallId: 'call_1' },
      { clientFamily: 'claude-code', toolCallId: 'call_1' }
    ]);

    expect(both.items.map(item => `${item.clientFamily}:${item.sessionKey}`)).toEqual([
      'claude-code:session-cc',
      'codex:session-codex'
    ]);
    expect(both.ambiguous).toEqual([]);
  });

  it('tolerates unknown and duplicate ids and skips records without a session', async () => {
    let records = [
      toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: 'toolu_1', type: 'tool.decision' }),
      {
        ...toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: 'toolu_1' }),
        ctx: { toolCallId: 'toolu_1' }
      },
      toolRecord({ at: '2026-11-27T10:00:01Z', toolCallId: 'toolu_2' })
    ];

    let result = await resolve(records, [
      { clientFamily: 'claude-code', toolCallId: 'toolu_1' },
      { clientFamily: 'claude-code', toolCallId: 'toolu_2' },
      { clientFamily: 'claude-code', toolCallId: 'toolu_2' },
      { clientFamily: 'claude-code', toolCallId: 'toolu_unknown' }
    ]);

    expect(result.items.map(item => item.toolCallId)).toEqual(['toolu_2']);
    expect(result.ambiguous).toEqual([]);
  });

  it('links nothing for an id found in more than one session and flags it', async () => {
    let records = [
      toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: '1', sessionKey: 'session-1' }),
      toolRecord({ at: '2026-11-27T10:05:00Z', toolCallId: '1', sessionKey: 'session-2' }),
      toolRecord({
        at: '2026-11-27T10:06:00Z',
        toolCallId: 'toolu_ok',
        sessionKey: 'session-2'
      })
    ];

    let result = await resolve(records, [
      { clientFamily: 'claude-code', toolCallId: '1' },
      { clientFamily: 'claude-code', toolCallId: 'toolu_ok' }
    ]);

    expect(result.items.map(item => item.toolCallId)).toEqual(['toolu_ok']);
    expect(result.ambiguous).toEqual([{ clientFamily: 'claude-code', toolCallId: '1' }]);
  });

  it('treats an id stored more often than one call can be as ambiguous', async () => {
    let records = Array.from({ length: 12 }, (_, index) =>
      toolRecord({
        at: `2026-11-27T10:00:${String(index).padStart(2, '0')}Z`,
        toolCallId: 'call_0',
        sessionKey: 'session-1'
      })
    );
    let reads: number[] = [];

    let result = await resolveToolCallSessions({
      ...scope,
      calls: [{ clientFamily: 'claude-code', toolCallId: 'call_0' }],
      read: async d => {
        let found = await readerOf(records)(d);
        reads.push(found.length);
        return found;
      }
    });

    expect(reads).toEqual([9]);
    expect(result).toEqual({
      items: [],
      ambiguous: [{ clientFamily: 'claude-code', toolCallId: 'call_0' }]
    });
  });

  it('matches an id longer than ingest keeps by its stored prefix', async () => {
    let long = `toolu_${'x'.repeat(300)}`;
    let records = [toolRecord({ at: '2026-11-27T10:00:00Z', toolCallId: long.slice(0, 256) })];

    let result = await resolve(records, [{ clientFamily: 'claude-code', toolCallId: long }]);

    expect(result.items).toEqual([expect.objectContaining({ toolCallId: long })]);
  });

  it('orders calls of the same time by record and id', async () => {
    let at = '2026-11-27T10:00:00Z';
    let records = [
      toolRecord({ id: 'rec_b', at, toolCallId: 'toolu_b' }),
      toolRecord({ id: 'rec_a', at, toolCallId: 'toolu_a' })
    ];

    let result = await resolve(records, [
      { clientFamily: 'claude-code', toolCallId: 'toolu_b' },
      { clientFamily: 'claude-code', toolCallId: 'toolu_a' }
    ]);

    expect(result.items.map(item => item.toolCallId)).toEqual(['toolu_a', 'toolu_b']);
  });
});

describe('clampStoredId', () => {
  it('keeps what ingest keeps of an id', () => {
    expect(clampStoredId('toolu_1')).toBe('toolu_1');
    expect(clampStoredId('x'.repeat(300))).toHaveLength(256);
  });
});
