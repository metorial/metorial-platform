import { describe, expect, it } from 'vitest';
import {
  formatBucketRange,
  formatBucketTime,
  formatTimeTick,
  formatTooltipTime,
  toTimestamp
} from './time';

let HOUR = 3_600_000;
let DAY = 24 * HOUR;

describe('formatTimeTick', () => {
  it('shows clock time for short ranges and the date at midnight', () => {
    expect(formatTimeTick(new Date(2026, 9, 14, 9, 5), 6 * HOUR)).toBe('09:05');
    expect(formatTimeTick(new Date(2026, 9, 14, 0, 0), DAY)).toBe('Oct 14');
  });

  it('shows the day for ranges over three days', () => {
    expect(formatTimeTick(new Date(2026, 9, 14, 12, 0), 7 * DAY)).toBe('Oct 14');
  });

  it('shows the month for very long ranges', () => {
    expect(formatTimeTick(new Date(2026, 9, 14), 365 * DAY)).toBe('Oct 2026');
  });

  it('accepts timestamps and ISO strings', () => {
    let date = new Date(2026, 9, 14, 17, 30);

    expect(formatTimeTick(date.getTime(), HOUR)).toBe('17:30');
    expect(formatTimeTick(date.toISOString(), HOUR)).toBe('17:30');
    expect(toTimestamp(date.toISOString())).toBe(date.getTime());
  });
});

describe('formatTooltipTime', () => {
  let now = new Date(2026, 9, 14, 12, 0);

  it('shows date and time, with seconds on request', () => {
    expect(formatTooltipTime(new Date(2026, 9, 14, 9, 5, 7), { now })).toBe('Oct 14, 09:05');
    expect(formatTooltipTime(new Date(2026, 9, 14, 9, 5, 7), { now, seconds: true })).toBe(
      'Oct 14, 09:05:07'
    );
  });

  it('adds the year for dates outside the current year', () => {
    expect(formatTooltipTime(new Date(2025, 11, 31, 23, 0), { now })).toBe(
      'Dec 31, 2025, 23:00'
    );
  });
});

describe('formatBucketRange', () => {
  let now = new Date(2026, 9, 22, 12, 0);

  it('shows the clock range for sub-day buckets', () => {
    expect(formatBucketRange(new Date(2026, 9, 21, 19, 0), HOUR, { now })).toBe(
      'Oct 21 · 19:00 – 20:00'
    );
  });

  it('shows only the day for daily buckets and a day range for longer ones', () => {
    expect(formatBucketRange(new Date(2026, 9, 21), DAY, { now })).toBe('Oct 21');
    expect(formatBucketRange(new Date(2026, 9, 14), 7 * DAY, { now })).toBe('Oct 14 – Oct 20');
  });

  it('includes the year for buckets outside the current year', () => {
    expect(formatBucketRange(new Date(2025, 11, 31), DAY, { now })).toBe('Dec 31, 2025');
  });
});

describe('formatBucketTime', () => {
  it('uses the clock for sub-day buckets and the day otherwise', () => {
    expect(formatBucketTime(new Date(2026, 9, 21, 19, 0), HOUR)).toBe('19:00');
    expect(formatBucketTime(new Date(2026, 9, 21, 19, 0, 30), 10_000)).toBe('19:00:30');
    expect(formatBucketTime(new Date(2026, 9, 21), DAY)).toBe('Oct 21');
  });
});
