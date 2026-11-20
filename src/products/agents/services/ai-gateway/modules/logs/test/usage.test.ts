import { describe, expect, it } from 'vitest';
import { buildUsageTimeline, resolveUsageRange, usageBucketStages } from '../src/lib/usage';

let hourMs = 60 * 60 * 1000;

describe('resolveUsageRange', () => {
  it('picks the smallest interval that keeps the range near 500 buckets', () => {
    let from = new Date('2026-11-01T00:00:00Z');

    expect(resolveUsageRange({ from, to: new Date('2026-11-02T00:00:00Z') }).interval).toBe(
      '5m'
    );
    expect(resolveUsageRange({ from, to: new Date('2026-11-08T00:00:00Z') }).interval).toBe(
      '1h'
    );
    expect(resolveUsageRange({ from, to: new Date('2027-11-01T00:00:00Z') }).interval).toBe(
      '1d'
    );
  });

  it('aligns the start to the bucket boundary', () => {
    let range = resolveUsageRange({
      from: new Date('2026-11-01T10:37:00Z'),
      to: new Date('2026-11-01T14:00:00Z'),
      interval: '1h'
    });

    expect(range.from).toEqual(new Date('2026-11-01T10:00:00Z'));
    expect(range.intervalMs).toBe(hourMs);
  });

  it('rejects empty ranges and ranges with too many buckets', () => {
    let from = new Date('2026-11-01T00:00:00Z');

    expect(() => resolveUsageRange({ from, to: from })).toThrow(/after/);
    expect(() =>
      resolveUsageRange({ from, to: new Date('2026-12-01T00:00:00Z'), interval: '5m' })
    ).toThrow(/1500/);
  });
});

describe('usageBucketStages', () => {
  it('buckets by epoch arithmetic rather than $dateTrunc', () => {
    let [group] = usageBucketStages(hourMs);

    expect(JSON.stringify(group)).not.toContain('$dateTrunc');
    expect(group).toMatchObject({
      $group: {
        _id: {
          $subtract: [
            { $toLong: '$timing.receivedAt' },
            { $mod: [{ $toLong: '$timing.receivedAt' }, hourMs] }
          ]
        }
      }
    });
  });
});

describe('buildUsageTimeline', () => {
  it('fills empty buckets with zeros and averages latency per bucket', () => {
    let range = resolveUsageRange({
      from: new Date('2026-11-01T00:00:00Z'),
      to: new Date('2026-11-01T03:00:00Z'),
      interval: '1h'
    });

    let timeline = buildUsageTimeline(range, [
      {
        _id: new Date('2026-11-01T01:00:00Z').getTime(),
        requests: 4,
        succeeded: 3,
        failed: 1,
        cancelled: 0,
        rejected: 0,
        inputTokens: 400,
        cachedInputTokens: 100,
        outputTokens: 80,
        costUsd: 0.02,
        platformCostUsd: 0.015,
        totalLatencyMs: 1000
      }
    ]);

    expect(timeline.buckets.map(bucket => bucket.requests)).toEqual([0, 4, 0]);
    expect(timeline.buckets[0]!.averageLatencyMs).toBeNull();
    expect(timeline.buckets[1]).toMatchObject({
      start: new Date('2026-11-01T01:00:00Z'),
      inputTokens: 400,
      platformCostUsd: 0.015,
      averageLatencyMs: 250
    });
  });
});
