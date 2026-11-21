import { describe, expect, it } from 'vitest';
import {
  maxRangeDays,
  normalizeRange,
  previousRange,
  rangeCacheKey,
  resolveRange,
  startOfDayIn
} from '../src/lib/range';

let resolve = (preset: any, now: string, timeZone = 'UTC') =>
  resolveRange(normalizeRange({ preset, timeZone }), new Date(now));

describe('range presets', () => {
  it('defaults to the last 30 calendar days, ending now', () => {
    let range = resolveRange(normalizeRange({}), new Date('2026-11-18T15:30:00Z'));

    expect(range.preset).toBe('last_30_days');
    expect(range.from.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-18T15:30:00.000Z');
  });

  it('counts today and the days before it in the time zone', () => {
    let range = resolve('last_7_days', '2026-11-18T00:30:00Z', 'America/New_York');

    expect(range.from.toISOString()).toBe('2026-11-11T05:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-18T00:30:00.000Z');
  });

  it('starts today at local midnight, not UTC midnight', () => {
    let range = resolve('today', '2026-11-18T22:30:00Z', 'Asia/Tokyo');

    expect(range.from.toISOString()).toBe('2026-11-18T15:00:00.000Z');
  });

  it('resolves month to date and last month at month edges', () => {
    let mtd = resolve('month_to_date', '2026-03-01T00:10:00Z', 'Europe/Berlin');
    expect(mtd.from.toISOString()).toBe('2026-02-28T23:00:00.000Z');

    let last = resolve('last_month', '2026-01-15T12:00:00Z');
    expect(last.from.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(last.to.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps day boundaries right across a DST change', () => {
    let range = resolve('last_7_days', '2026-03-31T12:00:00Z', 'Europe/Berlin');

    expect(range.from.toISOString()).toBe('2026-03-24T23:00:00.000Z');
    expect(
      startOfDayIn({ year: 2026, month: 3, day: 30 }, 'Europe/Berlin').toISOString()
    ).toBe('2026-03-29T22:00:00.000Z');
  });
});

describe('explicit ranges', () => {
  it('passes from and to through', () => {
    let from = new Date('2026-11-01T00:00:00Z');
    let to = new Date('2026-11-08T00:00:00Z');

    expect(resolveRange(normalizeRange({ from, to }))).toEqual({
      preset: null,
      from,
      to,
      timeZone: 'UTC'
    });
  });

  it('accepts exactly the maximum range and rejects longer ones', () => {
    let from = new Date('2025-01-01T00:00:00Z');
    let to = new Date(from.getTime() + maxRangeDays * 86_400_000);

    expect(() => normalizeRange({ from, to })).not.toThrow();
    expect(() => normalizeRange({ from, to: new Date(to.getTime() + 1) })).toThrow(/400 days/);
  });

  it('rejects half ranges, empty ranges, mixed input and unknown time zones', () => {
    let from = new Date('2026-11-01T00:00:00Z');

    expect(() => normalizeRange({ from })).toThrow(/both from and to/);
    expect(() => normalizeRange({ from, to: from })).toThrow(/after from/);
    expect(() => normalizeRange({ preset: 'today', from, to: new Date() })).toThrow(
      /not both/
    );
    expect(() => normalizeRange({ timeZone: 'Mars/Olympus' })).toThrow(/time zone/);
  });
});

describe('range cache keys', () => {
  it('keys a preset by name and the zone date, so the moving end does not defeat the cache', () => {
    let range = normalizeRange({ preset: 'today', timeZone: 'Europe/Berlin' });

    expect(rangeCacheKey(range, new Date('2026-11-18T10:00:00Z'))).toEqual({
      preset: 'today',
      timeZone: 'Europe/Berlin',
      today: '2026-11-18'
    });
    expect(rangeCacheKey(range, new Date('2026-11-18T10:00:00Z'))).toEqual(
      rangeCacheKey(range, new Date('2026-11-18T22:59:00Z'))
    );
  });

  it('changes the key at midnight in the zone, not in UTC', () => {
    let range = normalizeRange({ preset: 'last_month', timeZone: 'Europe/Berlin' });

    expect(rangeCacheKey(range, new Date('2026-11-30T22:59:59Z')).today).toBe('2026-11-30');
    expect(rangeCacheKey(range, new Date('2026-11-30T23:00:00Z')).today).toBe('2026-12-01');
  });
});

describe('previous period', () => {
  let previous = (preset: any, now: string, timeZone = 'UTC') => {
    let range = previousRange(resolve(preset, now, timeZone));

    return [range.from.toISOString(), range.to.toISOString()];
  };

  it('compares a rolling range with the same length right before it', () => {
    expect(previous('last_7_days', '2026-11-18T15:30:00Z')).toEqual([
      '2026-11-05T08:30:00.000Z',
      '2026-11-12T00:00:00.000Z'
    ]);
    expect(previous('last_30_days', '2026-11-18T00:00:00Z')).toEqual([
      '2026-09-21T00:00:00.000Z',
      '2026-10-20T00:00:00.000Z'
    ]);

    let explicit = previousRange(
      resolveRange(
        normalizeRange({
          from: new Date('2026-11-10T00:00:00Z'),
          to: new Date('2026-11-12T06:00:00Z')
        })
      )
    );
    expect([explicit.from.toISOString(), explicit.to.toISOString()]).toEqual([
      '2026-11-07T18:00:00.000Z',
      '2026-11-10T00:00:00.000Z'
    ]);
  });

  it('compares today with yesterday up to the same time of day', () => {
    expect(previous('today', '2026-11-18T15:30:00Z')).toEqual([
      '2026-11-17T00:00:00.000Z',
      '2026-11-17T15:30:00.000Z'
    ]);
    expect(previous('today', '2026-11-18T22:30:00Z', 'Asia/Tokyo')).toEqual([
      '2026-11-17T15:00:00.000Z',
      '2026-11-17T22:30:00.000Z'
    ]);
  });

  it('compares month to date with last month up to the same day and time', () => {
    expect(previous('month_to_date', '2026-11-18T15:30:00Z')).toEqual([
      '2026-10-01T00:00:00.000Z',
      '2026-10-18T15:30:00.000Z'
    ]);
    expect(previous('month_to_date', '2026-03-31T10:00:00Z')).toEqual([
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z'
    ]);
    expect(previous('month_to_date', '2026-01-05T08:00:00Z', 'Europe/Berlin')).toEqual([
      '2025-11-30T23:00:00.000Z',
      '2025-12-05T08:00:00.000Z'
    ]);
  });

  it('compares last month with the month before it', () => {
    expect(previous('last_month', '2026-03-15T12:00:00Z')).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z'
    ]);
    expect(previous('last_month', '2026-01-15T12:00:00Z', 'Europe/Berlin')).toEqual([
      '2025-10-31T23:00:00.000Z',
      '2025-11-30T23:00:00.000Z'
    ]);
  });
});
