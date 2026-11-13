import { describe, expect, it } from 'vitest';
import { createDeclarationLookup } from '../../billing/resolve';
import { createCatalogIndex } from '../../catalog';
import { fixtureCatalog } from '../../catalog/tests/fixture';
import type { PricePeriod } from '../../knowledge/periods';
import { pricing } from '../../knowledge/tests/fixtures';
import type { MatchableOverride } from '../../pricing/match';
import { createOverridePricer } from '../../pricing/pricer';
import { override } from '../../pricing/tests/fixtures';
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

describe('aggregateSession price history and vendors', () => {
  let changedAt = new Date('2026-03-04T10:10:00Z');

  let pricePeriod = (
    id: string,
    input: number,
    validFrom: string | Date,
    validTo: Date | null,
    confirmedAt: Date
  ): PricePeriod => ({
    id,
    pricing: pricing(input),
    origin: 'observed',
    closeReason: validTo ? 'changed' : null,
    validFrom: new Date(validFrom),
    validTo,
    confirmedAt
  });

  let history = createCatalogIndex(fixtureCatalog, {
    periods: {
      'anthropic:claude-sonnet-4-5': [
        pricePeriod('gpp_old', 3, '2026-01-01T00:00:00Z', changedAt, changedAt),
        pricePeriod('gpp_new', 2, changedAt, null, changedAt)
      ]
    }
  });

  let request = (
    at: string,
    model: Record<string, unknown>,
    extra: Partial<Parameters<typeof summaryRecord>[0]> = {}
  ) =>
    summaryRecord({
      type: 'model.request',
      at,
      data: { model, usage: { inputUncached: 1_000_000 } },
      ...extra
    });

  let sonnet = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

  it('prices each request with the period valid at its time and records provenance', async () => {
    let { summary, slices } = await aggregateSession({
      records: [
        request('2026-03-04T10:00:00Z', sonnet),
        request('2026-03-04T10:20:00Z', sonnet)
      ],
      family: 'claude-code',
      catalog: history
    });

    expect(decimal(summary.costComputedUsd)).toBe('5');
    expect(summary.models).toHaveLength(1);
    expect(summary.models[0]).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      vendorId: 'anthropic',
      vendorSource: 'reported',
      offeringId: 'anthropic:claude-sonnet-4-5',
      pricePeriodIds: ['gpp_old', 'gpp_new'],
      requests: 2
    });
    expect(summary.models[0]!.priceAssumed).toBeUndefined();

    expect(
      slices
        .filter(slice => slice.requests)
        .map(slice => [
          slice.bucket.toISOString(),
          slice.vendorId,
          slice.vendorSource,
          decimal(slice.costComputedUsd)
        ])
    ).toEqual([
      ['2026-03-04T10:00:00.000Z', 'anthropic', 'reported', '3'],
      ['2026-03-04T10:15:00.000Z', 'anthropic', 'reported', '2']
    ]);
  });

  it('flags the price as assumed when any request used an unconfirmed price', async () => {
    let { summary } = await aggregateSession({
      records: [
        request('2026-03-04T10:20:00Z', sonnet),
        request('2026-03-20T10:00:00Z', sonnet)
      ],
      family: 'claude-code',
      catalog: history
    });

    expect(summary.models[0]).toMatchObject({
      pricePeriodIds: ['gpp_new'],
      priceAssumed: true
    });
    expect(decimal(summary.costComputedUsd)).toBe('4');
  });

  it('keeps one model row per vendor and the strongest vendor source', async () => {
    let { summary, slices } = await aggregateSession({
      records: [
        request('2026-03-04T10:00:00Z', sonnet),
        request('2026-03-04T10:01:00Z', { id: 'claude-sonnet-4-5-20250929' }),
        request('2026-03-04T10:02:00Z', {
          id: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
          provider: 'bedrock'
        })
      ],
      family: 'claude-code',
      catalog
    });

    let rows = summary.models.map(model => [
      model.vendorId,
      model.vendorSource,
      model.offeringId,
      model.requests,
      decimal(model.costComputedUsd)
    ]);
    expect(rows).toEqual([
      ['anthropic', 'reported', 'anthropic:claude-sonnet-4-5', 2, '12'],
      ['aws-bedrock', 'reported', 'aws-bedrock:claude-sonnet-4-5', 1, '3.3']
    ]);

    expect(
      slices
        .filter(slice => slice.requests)
        .map(slice => [slice.vendorId, slice.vendorSource, slice.requests])
    ).toEqual([
      ['anthropic', 'reported', 1],
      ['anthropic', 'offering', 1],
      ['aws-bedrock', 'reported', 1]
    ]);
  });

  it('resolves the vendor from a base URL and from a subscription plan', async () => {
    let { summary } = await aggregateSession({
      records: [
        request('2026-03-04T10:00:00Z', {
          id: 'claude-sonnet-4-5-20250929',
          baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com/model/invoke'
        })
      ],
      family: 'claude-code',
      catalog
    });
    expect(summary.models[0]).toMatchObject({
      vendorId: 'aws-bedrock',
      vendorSource: 'endpoint',
      offeringId: 'aws-bedrock:claude-sonnet-4-5'
    });

    let copilot = (authMode?: string) =>
      aggregateSession({
        records: [
          request(
            '2026-03-04T10:00:00Z',
            { id: 'Claude Sonnet Latest' },
            {
              client: { family: 'copilot-cli', ...(authMode ? { authMode } : {}) }
            }
          )
        ],
        family: 'copilot-cli',
        catalog
      });

    expect((await copilot('subscription')).summary.models[0]).toMatchObject({
      vendorId: 'github-copilot',
      vendorSource: 'agent',
      offeringId: 'github-copilot:claude-sonnet-4-5'
    });
    expect((await copilot()).summary.models[0]).toMatchObject({
      vendorId: 'anthropic',
      vendorSource: 'first-party'
    });
  });
});

describe('aggregateSession contract cost', () => {
  let sonnet = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

  let request = (at: string, extra: Record<string, unknown> = {}) =>
    summaryRecord({
      type: 'model.request',
      at,
      data: { model: sonnet, usage: { inputUncached: 100_000 }, ...extra }
    });

  let aggregate = (
    records: ReturnType<typeof request>[],
    overrides: MatchableOverride[],
    projectId = 'gpr_a'
  ) =>
    aggregateSession({
      records,
      family: 'claude-code',
      catalog,
      pricing: createOverridePricer({
        overrides,
        organizationId: 'gor_a',
        projectId,
        catalog
      })
    });

  let half = override({ target: 'model', targetId: 'claude-sonnet-4-5', multiplier: '0.5' });

  it('records the override and contract cost and prefers the contract cost', async () => {
    let { summary, slices } = await aggregate([request('2026-03-04T10:00:00Z')], [half]);

    expect(decimal(summary.costComputedUsd)).toBe('0.3');
    expect(decimal(summary.costContractUsd)).toBe('0.15');
    expect(decimal(summary.costUsd)).toBe('0.15');
    expect(summary.models).toHaveLength(1);
    expect(summary.models[0]).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      overrideId: half.id
    });
    expect(decimal(summary.models[0]!.costContractUsd)).toBe('0.15');
    expect(decimal(summary.models[0]!.costComputedUsd)).toBe('0.3');

    let [slice] = slices.filter(slice => slice.requests);
    expect(decimal(slice!.costComputedUsd)).toBe('0.3');
    expect(decimal(slice!.costContractUsd)).toBe('0.15');
    expect(decimal(slice!.costUsd)).toBe('0.15');
  });

  it('keeps list cost alone when no override matches', async () => {
    let { summary, slices } = await aggregate(
      [request('2026-03-04T10:00:00Z')],
      [half],
      'gpr_b'
    );
    let scoped = await aggregate(
      [request('2026-03-04T10:00:00Z')],
      [{ ...half, projectId: 'gpr_a' }],
      'gpr_b'
    );

    expect(summary.costContractUsd).toBeDefined();
    expect(scoped.summary.costContractUsd).toBeUndefined();
    expect(scoped.summary.models[0]!.overrideId).toBeUndefined();
    expect(decimal(scoped.summary.costUsd)).toBe('0.3');
    expect(scoped.slices.every(slice => slice.costContractUsd === undefined)).toBe(true);
    expect(slices.some(slice => slice.costContractUsd !== undefined)).toBe(true);
  });

  it('splits model rows per override and counts unmatched requests at list cost', async () => {
    let ending = override({
      target: 'model',
      targetId: 'claude-sonnet-4-5',
      multiplier: '0.5',
      validTo: new Date('2026-03-04T10:10:00Z')
    });

    let { summary, slices } = await aggregate(
      [request('2026-03-04T10:00:00Z'), request('2026-03-04T10:20:00Z')],
      [ending]
    );

    expect(
      summary.models.map(model => [
        model.overrideId ?? null,
        model.requests,
        decimal(model.costComputedUsd),
        decimal(model.costContractUsd) ?? null
      ])
    ).toEqual([
      [ending.id, 1, '0.3', '0.15'],
      [null, 1, '0.3', null]
    ]);
    expect(decimal(summary.costComputedUsd)).toBe('0.6');
    expect(decimal(summary.costContractUsd)).toBe('0.15');
    expect(decimal(summary.costUsd)).toBe('0.45');

    expect(
      slices
        .filter(slice => slice.requests)
        .map(slice => [decimal(slice.costContractUsd) ?? null, decimal(slice.costUsd)])
    ).toEqual([
      ['0.15', '0.15'],
      [null, '0.3']
    ]);
  });

  it('prices included usage at zero and rates overrides with their own rates', async () => {
    let included = override({
      target: 'agent',
      targetId: 'claude-code',
      kind: 'included',
      multiplier: null
    });
    let rates = override({
      target: 'vendor',
      targetId: 'anthropic',
      kind: 'rates',
      multiplier: null,
      rates: pricing(1)
    });

    let free = await aggregate([request('2026-03-04T10:00:00Z')], [rates, included]);
    expect(decimal(free.summary.costContractUsd)).toBe('0');
    expect(decimal(free.summary.costUsd)).toBe('0');
    expect(free.summary.models[0]!.overrideId).toBe(included.id);

    let negotiated = await aggregate([request('2026-03-04T10:00:00Z')], [rates]);
    expect(decimal(negotiated.summary.costContractUsd)).toBe('0.1');
    expect(decimal(negotiated.summary.costUsd)).toBe('0.1');
  });

  it('prefers a billed cost over the contract cost and the contract over estimates', async () => {
    let billed = await aggregate(
      [request('2026-03-04T10:00:00Z', { cost: usd('0.42', 'billed') })],
      [half]
    );
    expect(decimal(billed.summary.costContractUsd)).toBe('0.15');
    expect(decimal(billed.summary.costUsd)).toBe('0.42');

    for (let basis of ['server_estimate', 'client_estimate']) {
      let estimated = await aggregate(
        [request('2026-03-04T10:00:00Z', { cost: usd('0.42', basis) })],
        [half]
      );
      expect(decimal(estimated.summary.costUsd)).toBe('0.15');
    }
  });
});

describe('aggregateSession billing', () => {
  let sonnet = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

  let request = (
    at: string,
    data: Record<string, unknown> = {},
    extra: Partial<Parameters<typeof summaryRecord>[0]> = {}
  ) =>
    summaryRecord({
      type: 'model.request',
      at,
      ...extra,
      data: { model: sonnet, usage: { inputUncached: 100_000 }, ...data }
    });

  let billingOf = (row: {
    billingMode?: string;
    billingSource?: string;
    billingPlan?: string;
    requests: number;
  }) => [row.billingMode, row.billingSource ?? null, row.billingPlan ?? null, row.requests];

  it('splits model rows and slices per billing mode, source and plan', async () => {
    let { summary, slices } = await aggregateSession({
      records: [
        request('2026-03-04T10:00:00Z', { billing: { mode: 'included', plan: 'max' } }),
        request('2026-03-04T10:01:00Z', { billing: { mode: 'included', plan: 'max' } }),
        request('2026-03-04T10:02:00Z', { billing: { mode: 'api' } }),
        request('2026-03-04T10:03:00Z')
      ],
      family: 'claude-code',
      catalog
    });

    expect(summary.requests).toBe(4);
    expect(summary.models.map(billingOf)).toEqual([
      ['included', 'reported', 'max', 2],
      ['api', 'reported', null, 1],
      ['unknown', null, null, 1]
    ]);
    expect(
      slices
        .filter(slice => slice.requests)
        .map(slice => billingOf(slice))
        .sort()
    ).toEqual([
      ['api', 'reported', null, 1],
      ['included', 'reported', 'max', 2],
      ['unknown', null, null, 1]
    ]);
    expect(decimal(summary.models[0]!.costComputedUsd)).toBe('0.6');
  });

  it('still reads the auth mode of records without billing', async () => {
    let { summary } = await aggregateSession({
      records: [
        request(
          '2026-03-04T10:00:00Z',
          {},
          { client: { family: 'codex', authMode: 'Chatgpt' } }
        ),
        request(
          '2026-03-04T10:01:00Z',
          {},
          { client: { family: 'codex', authMode: 'ApiKey' } }
        )
      ],
      family: 'codex',
      catalog
    });

    expect(summary.models.map(billingOf)).toEqual([
      ['included', 'reported', null, 1],
      ['api', 'reported', null, 1]
    ]);
  });

  it('picks the subscription vendor for plan usage', async () => {
    let copilot = (billing?: Record<string, unknown>) =>
      aggregateSession({
        records: [
          request(
            '2026-03-04T10:00:00Z',
            { model: { id: 'Claude Sonnet Latest' }, ...(billing ? { billing } : {}) },
            { client: { family: 'copilot-cli' } }
          )
        ],
        family: 'copilot-cli',
        catalog
      });

    expect((await copilot({ mode: 'included' })).summary.models[0]).toMatchObject({
      vendorId: 'github-copilot',
      vendorSource: 'agent',
      billingMode: 'included'
    });
    expect((await copilot({ mode: 'overage' })).summary.models[0]!.vendorId).toBe(
      'github-copilot'
    );
    expect((await copilot({ mode: 'api' })).summary.models[0]).toMatchObject({
      vendorId: 'anthropic',
      vendorSource: 'first-party',
      billingMode: 'api'
    });
  });

  it("infers Claude Code overage from the main thread's cache TTL", async () => {
    let plan = { mode: 'included', plan: 'max' };
    let write = (ttl: '1h' | '5m') => ({
      inputUncached: 1000,
      ...(ttl == '1h' ? { cacheWrite1h: 1000 } : { cacheWrite5m: 1000 })
    });

    let { summary, slices } = await aggregateSession({
      records: [
        request('2026-03-04T10:00:00Z', {
          billing: plan,
          purpose: 'main',
          usage: write('1h')
        }),
        request('2026-03-04T10:20:00Z', {
          billing: plan,
          purpose: 'main',
          usage: write('5m')
        }),
        request(
          '2026-03-04T10:21:00Z',
          { billing: plan, purpose: 'subagent', usage: write('5m') },
          { ctx: { agent: { id: 'agent_sub' } } }
        )
      ],
      family: 'claude-code',
      catalog
    });

    expect(summary.models.map(billingOf)).toEqual([
      ['included', 'reported', 'max', 1],
      ['overage', 'inferred', 'max', 2]
    ]);
    expect(summary.models[1]!.costComputedUsd).toBeDefined();
    expect(
      slices
        .filter(slice => slice.requests)
        .map(slice => [slice.billingMode, slice.subagentId ?? null])
    ).toEqual([
      ['included', null],
      ['overage', null],
      ['overage', 'agent_sub']
    ]);
  });

  it('bills a Codex session on a third-party provider per token and resolves its vendor', async () => {
    let { summary, slices } = await aggregateSession({
      records: [
        summaryRecord({
          type: 'session.start',
          at: '2026-03-04T10:00:00Z',
          data: { provider: 'bedrock' }
        }),
        request(
          '2026-03-04T10:00:10Z',
          { model: { id: 'claude-sonnet-4-5-20250929' }, billing: { mode: 'included' } },
          { client: { family: 'codex', authMode: 'Chatgpt' } }
        )
      ],
      family: 'codex',
      catalog
    });

    expect(summary.models.map(billingOf)).toEqual([['api', 'client', null, 1]]);
    expect(summary.models[0]).toMatchObject({
      vendorId: 'aws-bedrock',
      vendorSource: 'reported'
    });
    expect(slices.find(slice => slice.requests)).toMatchObject({
      provider: 'bedrock',
      billingMode: 'api'
    });
  });

  it('fills unknown usage from a declaration for the user and agent', async () => {
    let declarations = createDeclarationLookup({
      declarations: [
        {
          id: 'gbd_user',
          organizationId: 'gor_a',
          projectId: null,
          userId: 'gen_user',
          agentId: 'claude-code',
          mode: 'included',
          plan: 'team',
          validFrom: new Date('2026-01-01T00:00:00Z'),
          validTo: null,
          archivedAt: null
        }
      ],
      organizationId: 'gor_a',
      projectId: 'gpr_a'
    });

    let { summary } = await aggregateSession({
      records: [
        request('2026-03-04T10:00:00Z', {}, { attribution: { userId: 'gen_user' } }),
        request(
          '2026-03-04T10:01:00Z',
          { billing: { mode: 'api' } },
          { attribution: { userId: 'gen_user' } }
        ),
        request('2026-03-04T10:02:00Z', {}, { attribution: { userId: 'gen_other' } })
      ],
      family: 'claude-code',
      catalog,
      declarations
    });

    expect(summary.models.map(billingOf)).toEqual([
      ['included', 'declared', 'team', 1],
      ['api', 'reported', null, 1],
      ['unknown', null, null, 1]
    ]);
  });

  it('applies an override limited to billing modes only to those requests', async () => {
    let included = override({
      target: 'agent',
      targetId: 'claude-code',
      kind: 'included',
      multiplier: null,
      billingModes: ['included', 'overage']
    });

    let { summary } = await aggregateSession({
      records: [
        request('2026-03-04T10:00:00Z', { billing: { mode: 'included' } }),
        request('2026-03-04T10:01:00Z', { billing: { mode: 'api' } }),
        request('2026-03-04T10:02:00Z')
      ],
      family: 'claude-code',
      catalog,
      pricing: createOverridePricer({
        overrides: [included],
        organizationId: 'gor_a',
        projectId: 'gpr_a',
        catalog
      })
    });

    expect(
      summary.models.map(model => [
        model.billingMode,
        model.overrideId ?? null,
        decimal(model.costContractUsd) ?? null
      ])
    ).toEqual([
      ['included', included.id, '0'],
      ['api', null, null],
      ['unknown', null, null]
    ]);
    expect(decimal(summary.costUsd)).toBe('0.6');
  });
});

describe('cost basis selection', () => {
  let usdEntry = (basis: string, amount: bigint) => ({
    costs: [{ unit: 'usd', basis, amount }]
  });

  it('prefers billed, then contract, then server and client estimates, then computed', () => {
    let contract = { costs: [], computed: 2n, contract: 1n };

    expect(selectCostBasis([usdEntry('client_estimate', 1n), usdEntry('billed', 1n)])).toBe(
      'billed'
    );
    expect(selectCostBasis([contract, usdEntry('billed', 1n)])).toBe('billed');
    expect(selectCostBasis([usdEntry('server_estimate', 1n), contract])).toBe('contract');
    expect(selectCostBasis([usdEntry('client_estimate', 1n), contract])).toBe('contract');
    expect(
      selectCostBasis([usdEntry('client_estimate', 1n), usdEntry('server_estimate', 1n)])
    ).toBe('server_estimate');
    expect(
      selectCostBasis([usdEntry('client_estimate', 1n), { costs: [], computed: 1n }])
    ).toBe('client_estimate');
    expect(selectCostBasis([{ costs: [], computed: 1n }])).toBe('computed');
    expect(selectCostBasis([{ costs: [] }])).toBeUndefined();
  });

  it('counts a request without a contract cost at its list cost under the contract basis', () => {
    expect(preferredAmount({ costs: [], computed: 2n, contract: 1n }, 'contract')).toBe(1n);
    expect(preferredAmount({ costs: [], computed: 2n, contract: 0n }, 'contract')).toBe(0n);
    expect(preferredAmount({ costs: [], computed: 2n }, 'contract')).toBe(2n);
    expect(preferredAmount({ costs: [] }, 'contract')).toBeUndefined();
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
