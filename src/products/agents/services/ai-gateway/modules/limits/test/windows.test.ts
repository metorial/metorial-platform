import { describe, expect, it } from 'vitest';
import { fixedWindow, intervalWindow, secondsPeriod } from '../src/lib/windows';

let at = (iso: string) => Date.parse(iso);

describe('fixedWindow', () => {
  it('aligns windows to the epoch', () => {
    expect(fixedWindow(60_000, at('2026-11-20T12:34:56.789Z'))).toEqual({
      start: at('2026-11-20T12:34:00Z'),
      end: at('2026-11-20T12:35:00Z')
    });
  });

  it('puts the exact boundary into the next window', () => {
    let boundary = at('2026-11-20T12:35:00Z');

    expect(fixedWindow(60_000, boundary).start).toBe(boundary);
    expect(fixedWindow(60_000, boundary - 1).end).toBe(boundary);
  });

  it('supports odd window lengths', () => {
    let window = fixedWindow(7_000, 20_000);
    expect(window).toEqual({ start: 14_000, end: 21_000 });
  });
});

describe('intervalWindow', () => {
  let now = at('2026-11-20T12:34:56Z');

  it.each([
    ['1m', '2026-11-20T12:34:00Z', '2026-11-20T12:35:00Z'],
    ['1h', '2026-11-20T12:00:00Z', '2026-11-20T13:00:00Z'],
    ['1d', '2026-11-20T00:00:00Z', '2026-11-21T00:00:00Z'],
    ['1mo', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z']
  ] as const)('computes %s windows in UTC', (interval, start, end) => {
    expect(intervalWindow(interval, now)).toEqual({ start: at(start), end: at(end) });
  });

  it('rolls the month window over the year boundary', () => {
    expect(intervalWindow('1mo', at('2026-12-31T23:59:59Z'))).toEqual({
      start: at('2026-12-01T00:00:00Z'),
      end: at('2027-01-01T00:00:00Z')
    });
  });

  it('uses the real length of February in leap years', () => {
    expect(intervalWindow('1mo', at('2028-02-29T10:00:00Z'))).toEqual({
      start: at('2028-02-01T00:00:00Z'),
      end: at('2028-03-01T00:00:00Z')
    });
  });
});

describe('secondsPeriod', () => {
  it.each([
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [7200, '2 hours'],
    [600, '10 minutes'],
    [45, '45 seconds']
  ])('describes %i seconds as "%s"', (seconds, period) => {
    expect(secondsPeriod(seconds)).toBe(period);
  });
});
