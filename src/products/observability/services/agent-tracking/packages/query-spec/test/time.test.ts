import { describe, expect, it } from 'vitest';
import {
  bucketsBetween,
  formatInZone,
  isValidTimeZone,
  parseInstant,
  resolveRange,
  shiftRange,
  truncate
} from '../src';

let at = (value: string) => new Date(value);

describe('time', () => {
  it('validates time zones', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('truncates in a time zone, with Monday weeks', () => {
    let date = at('2026-11-13T22:30:00Z');

    expect(truncate(date, 'day', 'UTC').toISOString()).toBe('2026-11-13T00:00:00.000Z');
    expect(truncate(date, 'day', 'Europe/Berlin').toISOString()).toBe(
      '2026-11-12T23:00:00.000Z'
    );
    expect(truncate(date, 'week', 'UTC').toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(truncate(date, 'month', 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z'
    );
    expect(truncate(date, 'quarter', 'UTC').toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(truncate(date, 'year', 'UTC').toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(truncate(date, 'hour', 'Asia/Kolkata').toISOString()).toBe(
      '2026-11-13T22:30:00.000Z'
    );
  });

  it('resolves presets in the time zone', () => {
    let now = at('2026-11-13T10:00:00Z');

    expect(resolveRange({ preset: 'last_month' }, { now, timeZone: 'UTC' })).toEqual({
      from: at('2026-10-01T00:00:00Z'),
      to: at('2026-11-01T00:00:00Z')
    });
    expect(resolveRange({ preset: 'this_week' }, { now, timeZone: 'UTC' })).toEqual({
      from: at('2026-11-09T00:00:00Z'),
      to: at('2026-11-16T00:00:00Z')
    });
    expect(resolveRange({ preset: 'today' }, { now, timeZone: 'Europe/Berlin' })).toEqual({
      from: at('2026-11-12T23:00:00Z'),
      to: at('2026-11-13T23:00:00Z')
    });
    expect(resolveRange({ preset: 'last_quarter' }, { now, timeZone: 'UTC' })).toEqual({
      from: at('2026-07-01T00:00:00Z'),
      to: at('2026-10-01T00:00:00Z')
    });
  });

  it('resolves durations ending now', () => {
    let now = at('2026-03-31T12:00:00Z');

    expect(resolveRange({ last: '24h' }, { now, timeZone: 'UTC' }).from).toEqual(
      at('2026-03-30T12:00:00Z')
    );
    expect(resolveRange({ last: '1mo' }, { now, timeZone: 'UTC' }).from).toEqual(
      at('2026-03-03T12:00:00Z')
    );
    expect(resolveRange({ last: '1y' }, { now, timeZone: 'UTC' }).from).toEqual(
      at('2025-03-31T12:00:00Z')
    );
  });

  it('reads dates without an offset in the query time zone', () => {
    expect(parseInstant('2026-10-01', 'Europe/Berlin')).toEqual(at('2026-09-30T22:00:00Z'));
    expect(parseInstant('2026-10-01T08:30', 'UTC')).toEqual(at('2026-10-01T08:30:00Z'));
    expect(parseInstant('2026-10-01T00:00:00+02:00', 'UTC')).toEqual(
      at('2026-09-30T22:00:00Z')
    );
  });

  it('handles DST transitions', () => {
    let buckets = bucketsBetween(
      { from: at('2026-03-28T23:00:00Z'), to: at('2026-03-31T22:00:00Z') },
      'day',
      'Europe/Berlin',
      10
    );

    expect(buckets.map(bucket => bucket.toISOString())).toEqual([
      '2026-03-28T23:00:00.000Z',
      '2026-03-29T22:00:00.000Z',
      '2026-03-30T22:00:00.000Z'
    ]);
  });

  it('formats with the zone offset', () => {
    expect(formatInZone(at('2026-10-01T00:00:00Z'), 'Europe/Berlin')).toBe(
      '2026-10-01T02:00:00+02:00'
    );
    expect(formatInZone(at('2026-10-01T00:00:00Z'), 'UTC')).toBe('2026-10-01T00:00:00+00:00');
    expect(formatInZone(at('2026-10-01T00:00:00Z'), 'America/St_Johns')).toBe(
      '2026-09-30T21:30:00-02:30'
    );
  });

  it('shifts ranges for comparison', () => {
    let range = { from: at('2026-10-01T00:00:00Z'), to: at('2026-11-01T00:00:00Z') };

    expect(shiftRange(range, 'period', 'UTC')).toEqual({
      from: at('2026-08-31T00:00:00Z'),
      to: at('2026-10-01T00:00:00Z')
    });
    expect(shiftRange(range, 'year', 'UTC')).toEqual({
      from: at('2025-10-01T00:00:00Z'),
      to: at('2025-11-01T00:00:00Z')
    });
  });
});
