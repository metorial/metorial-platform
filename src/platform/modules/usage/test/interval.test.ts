import { describe, expect, it } from 'vitest';
import { getUsageBucketStarts, resolveUsageInterval } from '../src/lib/interval';

let HOUR_MS = 60 * 60 * 1000;

describe('usage intervals', () => {
  it('uses the explicit interval when given', () => {
    expect(
      resolveUsageInterval({ from: new Date(0), to: new Date(HOUR_MS), interval: '1h' })
    ).toEqual({ interval: '1h', intervalMs: HOUR_MS });
  });

  it('picks the smallest interval within the target point count', () => {
    let from = new Date('2026-01-01T00:00:00Z');

    expect(
      resolveUsageInterval({ from, to: new Date(from.getTime() + HOUR_MS) }).interval
    ).toBe('1m');
    expect(
      resolveUsageInterval({ from, to: new Date(from.getTime() + 24 * HOUR_MS) }).interval
    ).toBe('15m');
    expect(
      resolveUsageInterval({ from, to: new Date(from.getTime() + 30 * 24 * HOUR_MS) }).interval
    ).toBe('6h');
  });

  it('aligns bucket starts to the interval', () => {
    let starts = getUsageBucketStarts({
      from: new Date('2026-01-01T10:20:00Z'),
      to: new Date('2026-01-01T13:00:00Z'),
      intervalMs: HOUR_MS
    });

    expect(starts.map(start => new Date(start).toISOString())).toEqual([
      '2026-01-01T10:00:00.000Z',
      '2026-01-01T11:00:00.000Z',
      '2026-01-01T12:00:00.000Z'
    ]);
  });
});
