import { describe, expect, it } from 'vitest';
import { dateFromNanos, dateFromValue, firstDate } from '../time';

describe('dateFromNanos', () => {
  it('converts nanoseconds to a date, truncating sub-millisecond precision', () => {
    expect(dateFromNanos(1_781_524_800_123_999_999n)?.toISOString()).toBe(
      '2026-06-15T12:00:00.123Z'
    );
  });

  it('returns null for zero and negative values', () => {
    expect(dateFromNanos(0n)).toBeNull();
    expect(dateFromNanos(-5n)).toBeNull();
  });

  it('yields an invalid date for values beyond the date range', () => {
    expect(Number.isNaN(dateFromNanos(2n ** 80n)?.getTime())).toBe(true);
  });

  it('handles the epoch boundary', () => {
    expect(dateFromNanos(1_000_000n)?.getTime()).toBe(1);
    expect(dateFromNanos(999_999n)?.getTime()).toBe(0);
  });
});

describe('dateFromValue', () => {
  it('returns null for absent values', () => {
    expect(dateFromValue(undefined)).toBeNull();
    expect(dateFromValue(null)).toBeNull();
    expect(dateFromValue('')).toBeNull();
  });

  it('parses strings and numbers', () => {
    expect(dateFromValue('2026-06-15T12:00:00Z')?.toISOString()).toBe(
      '2026-06-15T12:00:00.000Z'
    );
    expect(dateFromValue(1_781_524_800_000)?.getTime()).toBe(1_781_524_800_000);
  });

  it('yields invalid dates for garbage', () => {
    for (let value of ['not a date', NaN, {}, [], true, 10n]) {
      expect(Number.isNaN(dateFromValue(value)?.getTime())).toBe(true);
    }
  });
});

describe('firstDate', () => {
  it('picks the first non-null candidate', () => {
    let a = new Date(1);
    let b = new Date(2);

    expect(firstDate(null, a, b)).toBe(a);
    expect(firstDate(b)).toBe(b);
  });

  it('keeps invalid dates because only null is skipped', () => {
    let invalid = new Date(NaN);

    expect(firstDate(null, invalid, new Date(1))).toBe(invalid);
  });

  it('returns null when nothing is available', () => {
    expect(firstDate()).toBeNull();
    expect(firstDate(null, null)).toBeNull();
  });
});
