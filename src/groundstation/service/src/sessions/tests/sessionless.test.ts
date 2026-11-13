import { describe, expect, it } from 'vitest';
import { createDeclarationLookup } from '../../billing/resolve';
import { createCatalogIndex } from '../../catalog';
import { fixtureCatalog } from '../../catalog/tests/fixture';
import { createOverridePricer } from '../../pricing/pricer';
import { override } from '../../pricing/tests/fixtures';
import { buildDraft } from '../../test/build';
import {
  isSessionlessUsage,
  sessionlessBaseSlices,
  sessionlessBucket,
  type SessionlessRecord
} from '../sessionless';

let catalog = createCatalogIndex(fixtureCatalog);

let day = new Date('2026-03-04T00:00:00.000Z');

let measurement = (d: {
  type: string;
  value: number;
  dims?: Record<string, unknown>;
  family?: string;
  window?: { start: Date; end: Date };
  aggregation?: string;
  unit?: string;
  userId?: string;
}): SessionlessRecord => {
  let window = d.window ?? { start: day, end: new Date(day.getTime() + 24 * 60 * 60 * 1000) };

  return {
    _id: crypto.randomUUID(),
    kind: 'measurement',
    type: d.type,
    occurredAt: window.end,
    source: { adapter: 'test', dialect: 'test.v1', channel: 's3_report', role: 'aggregate' },
    ingest: {
      credentialKind: 'source',
      credentialId: 'gis_1',
      route: 'bulk',
      requestId: 'req_1',
      backfill: false
    },
    client: { family: d.family ?? 'kiro' },
    data: {
      value: d.value,
      unit: d.unit ?? '{token}',
      aggregation: d.aggregation ?? 'delta',
      window,
      dims: d.dims ?? {}
    },
    attribution: { userId: d.userId ?? 'gen_user' }
  };
};

describe('sessionlessBucket', () => {
  it('uses daily buckets for daily windows and 15 minutes otherwise', () => {
    expect(
      sessionlessBucket({
        occurredAt: new Date('2026-03-05T00:00:00Z'),
        window: { start: day, end: new Date('2026-03-05T00:00:00Z') }
      })
    ).toEqual({ bucket: day, bucketMinutes: 1440 });

    expect(
      sessionlessBucket({
        occurredAt: new Date('2026-03-04T10:31:00Z'),
        window: {
          start: new Date('2026-03-04T10:30:00Z').toISOString(),
          end: new Date('2026-03-04T10:31:00Z').toISOString()
        }
      })
    ).toEqual({ bucket: new Date('2026-03-04T10:30:00Z'), bucketMinutes: 15 });

    expect(sessionlessBucket({ occurredAt: new Date('2026-03-04T10:44:00Z') })).toEqual({
      bucket: new Date('2026-03-04T10:30:00Z'),
      bucketMinutes: 15
    });
  });
});

describe('isSessionlessUsage', () => {
  let record = (family: string, type = 'tokens') =>
    buildDraft({
      kind: 'measurement',
      type,
      identity: crypto.randomUUID(),
      role: 'aggregate',
      client: { family }
    });

  it('only counts aggregates of families whose usage comes from aggregates', () => {
    expect(isSessionlessUsage(record('kiro'))).toBe(true);
    expect(isSessionlessUsage(record('kiro', 'active_time'))).toBe(false);
    expect(isSessionlessUsage(record('claude-code'))).toBe(false);

    let inSession = record('kiro');
    inSession.ctx.session_key = 'sess_1';
    expect(isSessionlessUsage(inSession)).toBe(false);
  });
});

describe('sessionlessBaseSlices', () => {
  it('sums token, request and cost aggregates per actor and model', async () => {
    let model = { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

    let slices = await sessionlessBaseSlices({
      bucket: day,
      catalog,
      records: [
        measurement({
          type: 'tokens',
          value: 1_000_000,
          dims: { ...model, tokenType: 'input_uncached' }
        }),
        measurement({
          type: 'tokens',
          value: 100_000,
          dims: { ...model, tokenType: 'output' }
        }),
        measurement({ type: 'requests', value: 12, dims: model }),
        measurement({ type: 'requests', value: 2, dims: { ...model, outcome: 'error' } }),
        measurement({ type: 'cost', value: 4.25, unit: 'USD', dims: model }),
        measurement({
          type: 'tokens',
          value: 50,
          userId: 'gen_other',
          dims: { tokenType: 'output' }
        }),
        measurement({ type: 'tokens', value: 7, aggregation: 'cumulative', dims: model }),
        measurement({ type: 'tokens', value: 7, family: 'cursor', dims: model }),
        measurement({
          type: 'tokens',
          value: 7,
          dims: model,
          window: {
            start: new Date('2026-03-04T10:00:00Z'),
            end: new Date('2026-03-04T10:01:00Z')
          }
        })
      ]
    });

    expect(slices).toHaveLength(2);

    let sonnet = slices.find(slice => slice.modelId == 'claude-sonnet-4-5')!;
    expect(sonnet).toMatchObject({
      bucket: day,
      bucketMinutes: 1440,
      vendorId: 'anthropic',
      vendorSource: 'reported',
      userId: 'gen_user',
      client: { family: 'kiro' },
      sessionsStarted: 0,
      requests: 14,
      failedRequests: 2
    });
    expect(sonnet.tokens).toMatchObject({ inputUncached: 1_000_000, output: 100_000 });
    expect(
      sonnet.costReported.map(cost => [cost.unit, cost.basis, cost.amount.toString()])
    ).toEqual([['usd', 'billed', '4.25']]);
    expect(sonnet.costComputedUsd?.toString()).toBe('4.5');
    expect(sonnet.costUsd?.toString()).toBe('4.25');

    let other = slices.find(slice => slice.userId == 'gen_other')!;
    expect(other.modelId).toBeUndefined();
    expect(other.vendorId).toBeUndefined();
    expect(other.tokens.output).toBe(50);
    expect(other.costUsd).toBeUndefined();
  });

  it('splits slices by vendor and prices each with its own offering', async () => {
    let tokens = (dims: Record<string, unknown>) =>
      measurement({
        type: 'tokens',
        value: 1_000_000,
        dims: { ...dims, tokenType: 'input_uncached' }
      });

    let slices = await sessionlessBaseSlices({
      bucket: day,
      catalog,
      records: [
        tokens({ model: 'claude-sonnet-4-5-20250929', provider: 'anthropic' }),
        tokens({ model: 'claude-sonnet-4-5-20250929', provider: 'bedrock' }),
        tokens({ model: 'claude-sonnet-4-5-20250929' })
      ]
    });

    expect(
      slices
        .map(slice => [slice.vendorId, slice.vendorSource, slice.costComputedUsd?.toString()])
        .sort()
    ).toEqual([
      ['anthropic', 'offering', '3'],
      ['anthropic', 'reported', '3'],
      ['aws-bedrock', 'reported', '3.3']
    ]);
  });

  it('bills subscription aggregates as included, by tier, declaration or default', async () => {
    let tokens = (userId: string, dims: Record<string, unknown> = {}) =>
      measurement({
        type: 'tokens',
        value: 1_000_000,
        userId,
        dims: { model: 'claude-sonnet-4-5-20250929', tokenType: 'input_uncached', ...dims }
      });

    let slices = await sessionlessBaseSlices({
      bucket: day,
      catalog,
      declarations: createDeclarationLookup({
        declarations: [
          {
            id: 'gbd_api',
            organizationId: 'gor_a',
            projectId: null,
            userId: 'gen_api',
            agentId: null,
            mode: 'api',
            plan: null,
            validFrom: new Date('2026-01-01T00:00:00Z'),
            validTo: null,
            archivedAt: null
          }
        ],
        organizationId: 'gor_a',
        projectId: 'gpr_a'
      }),
      records: [
        tokens('gen_pro', { subscription_tier: 'Pro' }),
        tokens('gen_api', { subscription_tier: 'Pro' }),
        tokens('gen_plain'),
        tokens('gen_api')
      ]
    });

    expect(
      slices
        .map(slice => [
          slice.userId,
          slice.billingMode,
          slice.billingSource ?? null,
          slice.billingPlan ?? null
        ])
        .sort()
    ).toEqual([
      ['gen_api', 'api', 'declared', null],
      ['gen_api', 'included', 'reported', 'Pro'],
      ['gen_plain', 'included', 'default', null],
      ['gen_pro', 'included', 'reported', 'Pro']
    ]);
  });

  it('adds the contract cost of the matching override and prefers it', async () => {
    let bedrock = override({ target: 'vendor', targetId: 'aws-bedrock', multiplier: '0.5' });
    let tokens = (provider: string) =>
      measurement({
        type: 'tokens',
        value: 1_000_000,
        dims: { model: 'claude-sonnet-4-5-20250929', provider, tokenType: 'input_uncached' }
      });

    let slices = await sessionlessBaseSlices({
      bucket: day,
      catalog,
      pricing: createOverridePricer({
        overrides: [bedrock],
        organizationId: 'gor_a',
        projectId: 'gpr_a',
        catalog
      }),
      records: [tokens('anthropic'), tokens('bedrock')]
    });

    expect(
      slices
        .map(slice => [
          slice.vendorId,
          slice.costComputedUsd?.toString(),
          slice.costContractUsd?.toString() ?? null,
          slice.costUsd?.toString()
        ])
        .sort()
    ).toEqual([
      ['anthropic', '3', null, '3'],
      ['aws-bedrock', '3.3', '1.65', '1.65']
    ]);
  });
});
