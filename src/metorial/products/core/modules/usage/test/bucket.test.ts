import { describe, expect, it } from 'vitest';
import {
  accumulateUsageEvent,
  decodeUsageBucketKey,
  encodeUsageBucketKey,
  floorToMinute,
  getUsageMetricId,
  parseUsageBucketHash,
  type UsageAccumulatedBucket
} from '../src/lib/bucket';

describe('usage buckets', () => {
  it('floors timestamps to the minute', () => {
    expect(floorToMinute(new Date('2026-01-01T10:15:42.123Z'))).toBe(
      new Date('2026-01-01T10:15:00.000Z').getTime()
    );
  });

  it('encodes keys independent of dimension order and drops empty dims', () => {
    let a = encodeUsageBucketKey({
      instanceId: 'ins_1',
      kind: 'tool_call',
      dims: { toolKey: 'search', providerId: 'pro_1', consumerId: '' }
    });
    let b = encodeUsageBucketKey({
      instanceId: 'ins_1',
      kind: 'tool_call',
      dims: { providerId: 'pro_1', toolKey: 'search' }
    });

    expect(a).toBe(b);
    expect(decodeUsageBucketKey(a)).toEqual({
      instanceId: 'ins_1',
      organizationId: null,
      kind: 'tool_call',
      dims: { providerId: 'pro_1', toolKey: 'search' }
    });
  });

  it('parses counter hashes grouped by bucket key', () => {
    let key = encodeUsageBucketKey({ instanceId: 'ins_1', kind: 'message' });
    let buckets = parseUsageBucketHash({
      [`${key}|c`]: '4',
      [`${key}|e`]: '1',
      [`${key}|d`]: '400',
      [`${key}|n`]: '4',
      [`${key}|x`]: '250',
      invalid: '1'
    });

    expect([...buckets.entries()]).toEqual([
      [
        key,
        { count: 4, errorCount: 1, durationMsSum: 400, durationCount: 4, durationMsMax: 250 }
      ]
    ]);
  });

  it('accumulates events per minute and key', () => {
    let buckets = new Map<string, UsageAccumulatedBucket>();
    let ts = new Date('2026-01-01T10:15:10Z');

    accumulateUsageEvent(buckets, {
      instanceId: 'ins_1',
      kind: 'tool_call',
      ts,
      durationMs: 100
    });
    accumulateUsageEvent(buckets, {
      instanceId: 'ins_1',
      kind: 'tool_call',
      ts: new Date('2026-01-01T10:15:50Z'),
      durationMs: 300,
      isError: true
    });
    accumulateUsageEvent(buckets, {
      instanceId: 'ins_1',
      kind: 'tool_call',
      ts: new Date('2026-01-01T10:16:01Z')
    });

    let values = [...buckets.values()];
    expect(values).toHaveLength(2);
    expect(values[0]!.counters).toEqual({
      count: 2,
      errorCount: 1,
      durationMsSum: 400,
      durationCount: 2,
      durationMsMax: 300
    });
    expect(values[1]!.counters.count).toBe(1);
    expect(values[1]!.counters.durationCount).toBe(0);
  });

  it('creates deterministic metric ids', () => {
    expect(getUsageMetricId(['live', 1, 'a'])).toBe(getUsageMetricId(['live', 1, 'a']));
    expect(getUsageMetricId(['live', 1, 'a'])).not.toBe(getUsageMetricId(['live', 1, 'b']));
  });
});
