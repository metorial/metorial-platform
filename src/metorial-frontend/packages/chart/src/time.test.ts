import { describe, expect, it } from 'vitest';
import { formatTimeTick, formatTooltipTime, toTimestamp } from './time';

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
