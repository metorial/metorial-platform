import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@metorial/db';
import { encodeUsageBucketKey } from '../src/lib/bucket';

let mocks = vi.hoisted(() => ({ read: vi.fn(), acknowledge: vi.fn(), requeue: vi.fn() }));

vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ add: mocks.requeue, process: (handler: unknown) => ({ handler }) }),
  combineQueueProcessors: () => ({}),
  dailyPacedDelay: () => ({ delay: 100 })
}));

vi.mock('@metorial/cron', () => ({ createCron: () => ({}) }));

vi.mock('../src/lib/buffer', () => ({
  parseClaimedUsageBucketKey: () => ({ minute: Date.UTC(2026, 0, 1), nonce: 'claim' }),
  readClaimedUsageBucket: mocks.read,
  acknowledgeClaimedUsageBucket: mocks.acknowledge
}));

let enabled = process.env.USAGE_TEST_POSTGRES === '1';

let from = new Date('2026-01-01T00:00:00Z');

let filter = {
  instanceIds: ['instance-a'],
  kinds: ['tool_call' as const],
  from,
  to: new Date('2026-01-01T00:03:00Z'),
  maxSeries: 1,
  includeDistinct: true
};

describe.skipIf(!enabled)('on-prem Postgres usage storage', () => {
  let storage: typeof import('../src/lib/postgres');

  beforeAll(async () => {
    storage = await import('../src/lib/postgres');
  });

  beforeEach(async () => {
    await db.usageMetric.deleteMany();
    mocks.read.mockReset();
    mocks.acknowledge.mockReset();
    mocks.requeue.mockReset();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('flushes live data idempotently without backfill state', async () => {
    let field = encodeUsageBucketKey({
      instanceId: 'instance-a',
      kind: 'tool_call',
      dims: { providerId: 'provider-a' }
    });
    mocks.read.mockResolvedValue({
      [`${field}|c`]: '4',
      [`${field}|e`]: '1',
      [`${field}|d`]: '600',
      [`${field}|n`]: '4',
      [`${field}|x`]: '300'
    });

    await Promise.all([storage.flushUsageBucket('claim'), storage.flushUsageBucket('claim')]);
    expect(await db.usageMetric.count()).toBe(1);
    let summary = await storage.queryUsageSummary(filter);
    expect(summary.total).toMatchObject({
      count: 4,
      errorCount: 1,
      durationMsSum: 600,
      durationMsMax: 300
    });
    expect(mocks.acknowledge).toHaveBeenCalledTimes(2);
  });

  it('does not acknowledge a claim when persistence fails', async () => {
    let field = encodeUsageBucketKey({ instanceId: 'instance-a', kind: 'tool_call' });
    mocks.read.mockResolvedValue({ [`${field}|c`]: '1.5' });
    await expect(storage.flushUsageBucket('claim')).rejects.toThrow();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it('aggregates dimensions, distinct identities, top groups, other groups and empty buckets', async () => {
    let base = {
      ts: from,
      instanceId: 'instance-a',
      kind: 'tool_call',
      errorCount: 0n,
      durationMsSum: 10n,
      durationCount: 1n,
      durationMsMax: 10n
    };
    await db.usageMetric.createMany({
      data: [
        {
          ...base,
          key: 'a',
          providerId: 'provider-a',
          consumerId: 'consumer-a',
          agentId: 'agent-a',
          count: 5n
        },
        {
          ...base,
          key: 'b',
          providerId: 'provider-b',
          consumerId: 'consumer-a',
          agentId: 'agent-b',
          count: 2n
        },
        {
          ...base,
          key: 'c',
          providerId: 'provider-c',
          consumerId: 'consumer-b',
          agentId: 'agent-b',
          count: 1n
        },
        { ...base, key: 'other-tenant', instanceId: 'instance-b', count: 100n }
      ]
    });

    let result = await storage.queryUsageTimeline({
      ...filter,
      intervalMs: 60_000,
      groupBy: 'provider'
    });
    expect(result.total).toHaveLength(3);
    expect(result.total[0]).toMatchObject({ count: 8, activeConsumers: 2, activeAgents: 2 });
    expect(result.total[1]).toMatchObject({ count: 0, activeConsumers: 0 });
    expect(
      result.series.find(series => series.group === '__other__')?.points[0]
    ).toMatchObject({ count: 3, activeConsumers: 2, activeAgents: 1 });

    let summary = await storage.queryUsageSummary({ ...filter, groupBy: 'provider' });
    expect(summary.total.count).toBe(8);
    expect(summary.top).toMatchObject([{ group: 'provider-a', count: 5 }]);
    let selected = await storage.queryUsageSummary({
      ...filter,
      dims: { providerId: ['provider-b'] }
    });
    expect(selected.total.count).toBe(2);
    expect((await storage.queryUsageSummary({ ...filter, instanceIds: [] })).total.count).toBe(
      0
    );
  });

  it('supports every dimension and excludes the upper time boundary', async () => {
    let dimensions = {
      providerId: 'p',
      deploymentId: 'd',
      consumerId: 'c',
      consumerProfileId: 'cp',
      agentId: 'a',
      magicMcpServerId: 'm',
      integrationId: 'i',
      toolKey: 't',
      errorType: 'e'
    };
    let row = {
      key: 'all-dimensions',
      ts: from,
      instanceId: 'instance-a',
      kind: 'tool_call',
      ...dimensions,
      count: 1n,
      errorCount: 1n,
      durationMsSum: 0n,
      durationCount: 0n,
      durationMsMax: 0n
    };
    await db.usageMetric.createMany({
      data: [row, { ...row, key: 'upper-bound', ts: filter.to }]
    });
    for (let [dimension, value] of Object.entries(dimensions)) {
      expect(
        (await storage.queryUsageSummary({ ...filter, dims: { [dimension]: [value] } })).total
          .count
      ).toBe(1);
      expect(
        (await storage.queryUsageSummary({ ...filter, dims: { [dimension]: ['absent'] } }))
          .total.count
      ).toBe(0);
    }
  });
  it('cleans expired metrics in bounded pages and preserves recent metrics', async () => {
    let { usageRetentionProcessor } = await import('../src/queues/retention');
    let cutoff = new Date('2026-01-02T00:00:00Z').toISOString();
    let base = {
      ts: from,
      instanceId: 'instance-a',
      kind: 'session',
      count: 1n,
      errorCount: 0n,
      durationMsSum: 0n,
      durationCount: 0n,
      durationMsMax: 0n
    };
    await db.usageMetric.createMany({
      data: [
        ...Array.from({ length: 501 }, (_, index) => ({ ...base, key: `expired-${index}` })),
        { ...base, key: 'recent', ts: new Date(cutoff) }
      ]
    });
    let processor = usageRetentionProcessor as unknown as {
      handler(data: { cutoff: string }): Promise<void>;
    };

    await processor.handler({ cutoff });
    expect(await db.usageMetric.count()).toBe(2);
    expect(mocks.requeue).toHaveBeenCalledTimes(1);
    mocks.requeue.mockClear();

    await processor.handler({ cutoff });
    expect(await db.usageMetric.count()).toBe(1);
    expect((await db.usageMetric.findFirst())?.key).toBe('recent');
    expect(mocks.requeue).not.toHaveBeenCalled();
  });
});
