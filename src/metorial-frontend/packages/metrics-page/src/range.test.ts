import { describe, expect, it } from 'vitest';
import {
  applyMetricsQuery,
  clampMetricsRange,
  defaultMetricsIntervals,
  formatDurationLong,
  formatIntervalShort,
  getMetricsIntervalChoices,
  getMetricsPresetChoices,
  defaultMetricsRangePresets,
  MetricsIntervalOption,
  parseMetricsQuery,
  pickAutoInterval,
  resolveMetricsInterval,
  resolveMetricsRange,
  serializeMetricsQuery
} from './range';

let MINUTE = 60_000;
let HOUR = 60 * MINUTE;
let DAY = 24 * HOUR;

let now = new Date('2026-10-14T12:00:00.000Z');
let ago = (ms: number) => new Date(now.getTime() - ms);

let intervals: MetricsIntervalOption[] = defaultMetricsIntervals.map(interval =>
  interval.durationMs < HOUR ? { ...interval, retentionMs: 7 * DAY } : interval
);

describe('resolveMetricsRange', () => {
  it('resolves a preset relative to now', () => {
    let range = resolveMetricsRange({ type: 'preset', preset: '6h' }, { now });

    expect(range.to).toEqual(now);
    expect(range.from).toEqual(ago(6 * HOUR));
  });

  it('falls back to the first preset for unknown ids', () => {
    let range = resolveMetricsRange({ type: 'preset', preset: 'nope' }, { now });
    expect(range.from).toEqual(ago(HOUR));
  });

  it('clamps presets to retention', () => {
    let range = resolveMetricsRange(
      { type: 'preset', preset: '30d' },
      { now, retentionMs: 7 * DAY }
    );
    expect(range.from).toEqual(ago(7 * DAY));
  });

  it('clamps custom ranges', () => {
    let range = resolveMetricsRange(
      { type: 'custom', from: ago(60 * DAY), to: new Date(now.getTime() + DAY) },
      { now, retentionMs: 30 * DAY }
    );

    expect(range.from).toEqual(ago(30 * DAY));
    expect(range.to).toEqual(now);
  });
});

describe('clampMetricsRange', () => {
  it('swaps inverted ranges', () => {
    let range = clampMetricsRange({ from: ago(HOUR), to: ago(2 * HOUR) }, { now });

    expect(range.from).toEqual(ago(2 * HOUR));
    expect(range.to).toEqual(ago(HOUR));
  });

  it('trims the start when the span is too long and anchored to the end', () => {
    let range = clampMetricsRange(
      { from: ago(40 * DAY), to: ago(DAY) },
      { now, maxSpanMs: 31 * DAY }
    );

    expect(range.to).toEqual(ago(DAY));
    expect(range.from).toEqual(ago(32 * DAY));
  });

  it('trims the end when anchored to the start', () => {
    let range = clampMetricsRange(
      { from: ago(40 * DAY), to: ago(DAY) },
      { now, maxSpanMs: 31 * DAY, anchor: 'from' }
    );

    expect(range.from).toEqual(ago(40 * DAY));
    expect(range.to).toEqual(ago(9 * DAY));
  });

  it('applies retention before the span limit', () => {
    let range = clampMetricsRange(
      { from: ago(90 * DAY), to: now },
      { now, retentionMs: 30 * DAY, maxSpanMs: 31 * DAY }
    );

    expect(range.from).toEqual(ago(30 * DAY));
    expect(range.to).toEqual(now);
  });
});

describe('getMetricsIntervalChoices', () => {
  it('disables sub-hour intervals for ranges starting outside their retention', () => {
    let choices = getMetricsIntervalChoices(
      intervals,
      { from: ago(10 * DAY), to: ago(DAY) },
      { now }
    );
    let byId = Object.fromEntries(choices.map(choice => [choice.id, choice]));

    expect(byId['1m'].disabled).toBe(true);
    expect(byId['1m'].disabledReason).toBe(
      'Only available for ranges within the last 7 days.'
    );
    expect(byId['1m'].disabledHint).toBe('Last 7 days only');
    expect(byId['15m'].disabled).toBe(true);
    expect(byId['1h'].disabled).toBe(false);
    expect(byId['1d'].disabled).toBe(false);
  });

  it('disables intervals longer than the range', () => {
    let choices = getMetricsIntervalChoices(
      intervals,
      { from: ago(6 * HOUR), to: now },
      { now }
    );
    let byId = Object.fromEntries(choices.map(choice => [choice.id, choice]));

    expect(byId['6h'].disabled).toBe(false);
    expect(byId['1d'].disabled).toBe(true);
    expect(byId['1d'].disabledReason).toBe('Longer than the selected range.');
  });

  it('disables intervals that produce too many points', () => {
    let choices = getMetricsIntervalChoices(
      intervals,
      { from: ago(7 * DAY), to: now },
      { now, maxPoints: 1500 }
    );
    let byId = Object.fromEntries(choices.map(choice => [choice.id, choice]));

    expect(byId['1m'].disabledReason).toBe('Too many data points for the selected range.');
    expect(byId['5m'].disabled).toBe(true);
    expect(byId['15m'].disabled).toBe(false);
  });
});

describe('getMetricsPresetChoices', () => {
  it('keeps every preset enabled without limits', () => {
    let choices = getMetricsPresetChoices(defaultMetricsRangePresets);

    expect(choices.every(choice => !choice.disabled)).toBe(true);
  });

  it('disables presets longer than the retention or the span limit', () => {
    let retained = getMetricsPresetChoices(defaultMetricsRangePresets, {
      retentionMs: 7 * DAY
    });
    let limited = getMetricsPresetChoices(defaultMetricsRangePresets, {
      maxSpanMs: 24 * HOUR
    });

    expect(retained.find(choice => choice.id == '7d')?.disabled).toBe(false);
    expect(retained.find(choice => choice.id == '30d')?.disabledReason).toBe(
      'Metrics are kept for 7 days.'
    );
    expect(limited.find(choice => choice.id == '24h')?.disabled).toBe(false);
    expect(limited.find(choice => choice.id == '7d')?.disabledReason).toBe(
      'Ranges are limited to 1 day.'
    );
  });
});

describe('pickAutoInterval', () => {
  it('targets about 500 points', () => {
    expect(pickAutoInterval(intervals, { from: ago(HOUR), to: now }, { now })?.id).toBe('1m');
    expect(pickAutoInterval(intervals, { from: ago(DAY), to: now }, { now })?.id).toBe('5m');
    expect(pickAutoInterval(intervals, { from: ago(7 * DAY), to: now }, { now })?.id).toBe(
      '1h'
    );
    expect(pickAutoInterval(intervals, { from: ago(30 * DAY), to: now }, { now })?.id).toBe(
      '6h'
    );
  });

  it('skips intervals outside their retention', () => {
    let picked = pickAutoInterval(
      intervals,
      { from: ago(9 * DAY), to: ago(8 * DAY) },
      { now }
    );
    expect(picked?.id).toBe('1h');
  });

  it('falls back to the largest interval', () => {
    let picked = pickAutoInterval(intervals, { from: ago(3650 * DAY), to: now }, { now });
    expect(picked?.id).toBe('1d');
  });
});

describe('resolveMetricsInterval', () => {
  let range = { from: ago(DAY), to: now };

  it('returns undefined for auto', () => {
    expect(resolveMetricsInterval('auto', intervals, range, { now })).toBeUndefined();
  });

  it('returns the enabled interval', () => {
    expect(resolveMetricsInterval('15m', intervals, range, { now })?.durationMs).toBe(
      15 * MINUTE
    );
  });

  it('returns undefined for disabled or unknown intervals', () => {
    expect(
      resolveMetricsInterval('1m', intervals, { from: ago(10 * DAY), to: now }, { now })
    ).toBeUndefined();
    expect(resolveMetricsInterval('2m', intervals, range, { now })).toBeUndefined();
  });
});

describe('metrics query params', () => {
  it('parses presets and intervals', () => {
    let query = parseMetricsQuery(new URLSearchParams('range=7d&interval=1h'));
    expect(query).toEqual({ range: { type: 'preset', preset: '7d' }, interval: '1h' });
  });

  it('parses custom ranges', () => {
    let query = parseMetricsQuery({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-03T00:00:00.000Z',
      range: '7d'
    });

    expect(query.range).toEqual({
      type: 'custom',
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-03T00:00:00.000Z')
    });
    expect(query.interval).toBe('auto');
  });

  it('falls back for invalid values', () => {
    let query = parseMetricsQuery({
      from: 'garbage',
      to: '2026-10-03T00:00:00.000Z',
      range: '2y',
      interval: '3m'
    });

    expect(query).toEqual({ range: { type: 'preset', preset: '24h' }, interval: 'auto' });
  });

  it('respects custom keys and defaults', () => {
    let query = parseMetricsQuery(
      { usageRange: '1h' },
      {
        keys: { range: 'usageRange' },
        defaultQuery: { range: { type: 'preset', preset: '6h' }, interval: '5m' }
      }
    );

    expect(query).toEqual({ range: { type: 'preset', preset: '1h' }, interval: '5m' });
  });

  it('serializes queries without the auto interval', () => {
    expect(
      serializeMetricsQuery({ range: { type: 'preset', preset: '6h' }, interval: 'auto' })
    ).toEqual({ range: '6h', from: undefined, to: undefined, interval: undefined });
  });

  it('applies queries onto existing params and round-trips', () => {
    let query = {
      range: {
        type: 'custom' as const,
        from: new Date('2026-10-01T00:00:00.000Z'),
        to: new Date('2026-10-02T00:00:00.000Z')
      },
      interval: '15m'
    };

    let params = applyMetricsQuery(new URLSearchParams('tab=usage&range=24h'), query);

    expect(params.get('tab')).toBe('usage');
    expect(params.has('range')).toBe(false);
    expect(params.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(params.get('interval')).toBe('15m');
    expect(parseMetricsQuery(params)).toEqual(query);
  });
});

describe('duration labels', () => {
  it('formats long durations', () => {
    expect(formatDurationLong(7 * DAY)).toBe('7 days');
    expect(formatDurationLong(HOUR)).toBe('1 hour');
    expect(formatDurationLong(90 * MINUTE)).toBe('90 minutes');
  });

  it('formats short intervals', () => {
    expect(formatIntervalShort(5 * MINUTE)).toBe('5m');
    expect(formatIntervalShort(DAY)).toBe('1d');
  });
});
