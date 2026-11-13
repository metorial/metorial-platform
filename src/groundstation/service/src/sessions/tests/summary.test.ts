import { describe, expect, it } from 'vitest';
import { createCatalogIndex } from '../../catalog';
import { fixtureCatalog } from '../../catalog/tests/fixture';
import { aggregateSession, preferredAmount, selectCostBasis } from '../summary';
import { summaryRecord, usd } from './fixtures';

let catalog = createCatalogIndex(fixtureCatalog);

let model = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

let sessionRecords = () => [
  summaryRecord({ type: 'session.start', at: '2026-03-04T10:00:00Z' }),
  summaryRecord({ type: 'prompt.submitted', at: '2026-03-04T10:00:05Z' }),
  summaryRecord({
    type: 'model.request',
    at: '2026-03-04T10:00:10Z',
    ctx: { requestId: 'r1' },
    data: { model, usage: { inputUncached: 1000, output: 100 } }
  }),
  summaryRecord({
    type: 'model.request',
    at: '2026-03-04T10:00:10Z',
    channel: 'otlp.logs',
    factKey: 'request:r1',
    ctx: { requestId: 'r1' },
    data: { model, usage: { inputUncached: 1000, output: 100 }, cost: usd('0.0045') }
  }),
  summaryRecord({
    type: 'model.request',
    at: '2026-03-04T10:00:10Z',
    channel: 'otlp.logs',
    factKey: 'request:r1',
    ctx: { requestId: 'r1' },
    data: { model, usage: { inputUncached: 1000, output: 100 }, cost: usd('0.0045') }
  }),
  summaryRecord({
    type: 'model.request',
    at: '2026-03-04T10:00:11Z',
    channel: 'otlp.traces',
    role: 'duplicate',
    data: { model, usage: { inputUncached: 99_999 } }
  }),
  summaryRecord({
    type: 'tool.call',
    at: '2026-03-04T10:00:20Z',
    data: { tool: { class: 'shell' }, lines: { added: 5, removed: 1 } }
  }),
  summaryRecord({
    type: 'tool.call',
    at: '2026-03-04T10:00:25Z',
    data: { tool: { class: 'mcp', mcp: { server: 'github' } }, error: { class: 'timeout' } }
  }),
  summaryRecord({
    type: 'code.change',
    at: '2026-03-04T10:00:30Z',
    data: { lines: { added: 3, removed: 2 } }
  }),
  summaryRecord({
    type: 'turn.completed',
    at: '2026-03-04T10:00:40Z',
    observedAt: '2026-03-04T10:00:41Z'
  }),
  summaryRecord({
    type: 'agent.start',
    at: '2026-03-04T10:20:00Z',
    ctx: { agent: { id: 'agent_sub' } },
    data: { name: 'Explore' }
  }),
  summaryRecord({
    type: 'model.request',
    at: '2026-03-04T10:20:00Z',
    channel: 'otlp.logs',
    ctx: { requestId: 'r2', agent: { id: 'agent_sub' } },
    data: { model, usage: { inputUncached: 2000, output: 200 }, cost: usd('0.009') }
  }),
  summaryRecord({
    type: 'usage.charge',
    at: '2026-03-04T10:25:00Z',
    channel: 'otlp.logs',
    ctx: { agent: { id: 'agent_sub' } },
    data: { for: { requestId: 'r2' }, cost: usd('0.01', 'billed') }
  }),
  summaryRecord({
    type: 'usage.charge',
    at: '2026-03-04T10:26:00Z',
    channel: 'otlp.logs',
    data: { cost: { ...usd('5', 'billed'), repeatsParent: true } }
  })
];

let decimal = (value: { toString(): string } | undefined) => value?.toString();

describe('aggregateSession', () => {
  it('counts primary records once, from the preferred usage source', async () => {
    let aggregate = await aggregateSession({
      records: sessionRecords(),
      family: 'claude-code',
      catalog
    });
    let { summary } = aggregate;

    expect(summary.prompts).toBe(1);
    expect(summary.turns).toBe(1);
    expect(summary.requests).toBe(2);
    expect(summary.tokens).toEqual({
      inputUncached: 3000,
      cacheRead: 0,
      cacheWrite: 0,
      output: 300,
      reasoning: 0
    });

    expect(summary.toolCalls).toBe(2);
    expect(summary.toolCallsByClass).toEqual({ shell: 1, mcp: 1 });
    expect(summary.mcpServers).toEqual(['github']);
    expect(summary.errorsByClass).toEqual({ timeout: 1 });
    expect(summary.lines).toEqual({ added: 3, removed: 2 });
    expect(summary.durationMs).toBe(26 * 60 * 1000);

    expect(aggregate.coverage).toEqual({
      hasUsage: true,
      hasContext: false,
      hasRepo: false,
      usageSource: 'otel.logs'
    });
    expect(aggregate.lastTurnObservedAt).toEqual(new Date('2026-03-04T10:00:41Z'));
  });

  it('prefers billed cost, keeps every reported basis and prices each request', async () => {
    let { summary } = await aggregateSession({
      records: sessionRecords(),
      family: 'claude-code',
      catalog
    });

    expect(decimal(summary.costUsd)).toBe('0.01');
    expect(decimal(summary.costComputedUsd)).toBe('0.0135');
    expect(
      summary.costReported.map(cost => ({ basis: cost.basis, amount: decimal(cost.amount) }))
    ).toEqual([
      { basis: 'client_estimate', amount: '0.0135' },
      { basis: 'billed', amount: '0.01' }
    ]);

    expect(summary.models).toHaveLength(1);
    expect(summary.models[0]).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      rawIds: ['claude-sonnet-4-5-20250929'],
      requests: 2
    });

    expect(summary.subagents).toEqual([
      expect.objectContaining({ agentId: 'agent_sub', name: 'Explore', requests: 1 })
    ]);
    expect(decimal(summary.subagents[0]!.costUsd)).toBe('0.01');
  });

  it('builds base slices per 15-minute bucket, model and subagent', async () => {
    let { slices } = await aggregateSession({
      records: sessionRecords(),
      family: 'claude-code',
      catalog
    });

    let byKey = new Map(
      slices.map(slice => [
        `${slice.bucket.toISOString()}|${slice.modelId ?? ''}|${slice.subagentId ?? ''}`,
        slice
      ])
    );

    let activity = byKey.get('2026-03-04T10:00:00.000Z||')!;
    expect(activity).toMatchObject({
      sessionsStarted: 1,
      turns: 1,
      toolCalls: 2,
      requests: 0
    });
    expect(activity.lines).toEqual({ added: 3, removed: 2 });

    let main = byKey.get('2026-03-04T10:00:00.000Z|claude-sonnet-4-5|')!;
    expect(main).toMatchObject({ sessionsStarted: 0, requests: 1, bucketMinutes: 15 });
    expect(decimal(main.costComputedUsd)).toBe('0.0045');
    expect(main.costUsd).toBeUndefined();

    let subagent = byKey.get('2026-03-04T10:15:00.000Z|claude-sonnet-4-5|agent_sub')!;
    expect(subagent.requests).toBe(1);
    expect(subagent.tokens.inputUncached).toBe(2000);
    expect(decimal(subagent.costUsd)).toBe('0.01');

    expect(slices.reduce((total, slice) => total + slice.sessionsStarted, 0)).toBe(1);
  });

  it('falls back to the next source when the preferred one sent no usage', async () => {
    let { summary, coverage } = await aggregateSession({
      records: sessionRecords().filter(record => record.source.channel != 'otlp.logs'),
      family: 'claude-code',
      catalog
    });

    expect(coverage.usageSource).toBe('hook');
    expect(summary.requests).toBe(1);
    expect(summary.tokens.inputUncached).toBe(1000);
    expect(decimal(summary.costUsd)).toBe('0.0045');
  });

  it('leaves model ids and computed cost out without a catalog', async () => {
    let { summary } = await aggregateSession({
      records: sessionRecords().filter(record => record.source.channel != 'otlp.logs'),
      family: 'claude-code',
      catalog: null
    });

    expect(summary.models[0]!.modelId).toBeUndefined();
    expect(summary.costComputedUsd).toBeUndefined();
    expect(summary.costUsd).toBeUndefined();
  });

  it('collects correlation ids of records observed after the given time', async () => {
    let records = sessionRecords();
    records[2]!.observedAt = new Date('2026-03-04T09:00:00Z');

    let all = await aggregateSession({ records, family: 'claude-code', catalog });
    expect(all.correlations).toEqual([
      { type: 'request', value: 'r1' },
      { type: 'request', value: 'r2' }
    ]);

    let recent = await aggregateSession({
      records,
      family: 'claude-code',
      catalog,
      correlationsSince: new Date('2026-03-04T10:10:00Z')
    });
    expect(recent.correlations).toEqual([{ type: 'request', value: 'r2' }]);
  });

  it('reads records from an async source', async () => {
    let source = async function* () {
      yield* sessionRecords();
    };

    let { records } = await aggregateSession({
      records: source(),
      family: 'claude-code',
      catalog
    });

    expect(records).toBe(sessionRecords().length);
  });
});

describe('cost basis selection', () => {
  let usdEntry = (basis: string, amount: bigint) => ({
    costs: [{ unit: 'usd', basis, amount }]
  });

  it('prefers billed, then server and client estimates, then computed', () => {
    expect(selectCostBasis([usdEntry('client_estimate', 1n), usdEntry('billed', 1n)])).toBe(
      'billed'
    );
    expect(
      selectCostBasis([usdEntry('client_estimate', 1n), usdEntry('server_estimate', 1n)])
    ).toBe('server_estimate');
    expect(selectCostBasis([{ costs: [], computed: 1n }])).toBe('computed');
    expect(selectCostBasis([{ costs: [] }])).toBeUndefined();
  });

  it('ignores costs that are not in USD when choosing and summing', () => {
    let entry = {
      costs: [
        { unit: 'credits', basis: 'billed', amount: 7n },
        { unit: 'cents', basis: 'client_estimate', amount: 250n }
      ],
      computed: 9n
    };

    let basis = selectCostBasis([entry]);
    expect(basis).toBe('client_estimate');
    expect(preferredAmount(entry, basis)).toBe(2n);
  });
});
