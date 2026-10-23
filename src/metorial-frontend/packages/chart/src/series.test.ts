import { describe, expect, it } from 'vitest';
import {
  fillTimeBuckets,
  getPlaceholderBarSeries,
  getPlaceholderSeries,
  getSmallestTimeStep,
  getTimeSpan,
  getValueBounds,
  hasChartData
} from './series';

let MINUTE = 60_000;

let at = (minutes: number) => new Date(Date.UTC(2026, 9, 14, 12, minutes));

describe('hasChartData', () => {
  it('is false for no series, empty series and series with only gaps', () => {
    expect(hasChartData([])).toBe(false);
    expect(hasChartData([{ id: 'a', name: 'A', entries: [] }])).toBe(false);
    expect(
      hasChartData([{ id: 'a', name: 'A', entries: [{ key: at(0), value: null }] }])
    ).toBe(false);
  });

  it('treats zero as data', () => {
    expect(hasChartData([{ id: 'a', name: 'A', entries: [{ key: at(0), value: 0 }] }])).toBe(
      true
    );
  });
});

describe('getValueBounds', () => {
  it('keeps dashed series and reference lines apart from the plotted maximum', () => {
    let bounds = getValueBounds(
      [
        {
          id: 'used',
          name: 'Used',
          entries: [
            { key: at(0), value: 0.4 },
            { key: at(1), value: 1.9 },
            { key: at(2), value: null }
          ]
        },
        {
          id: 'allocated',
          name: 'Allocated',
          style: 'dashed',
          entries: [{ key: at(0), value: 2 }]
        }
      ],
      [{ value: 4 }]
    );

    expect(bounds).toEqual({ min: 0.4, max: 1.9, capacityMax: 4 });
  });
});

describe('time helpers', () => {
  let series = [
    {
      id: 'a',
      name: 'A',
      entries: [
        { key: at(0), value: 1 },
        { key: at(1), value: 2 },
        { key: at(6), value: 3 }
      ]
    }
  ];

  it('derives the span from the domain or the data', () => {
    expect(getTimeSpan(series)).toBe(6 * MINUTE);
    expect(getTimeSpan(series, { from: at(0), to: at(60) })).toBe(60 * MINUTE);
  });

  it('finds the smallest step between entries', () => {
    expect(getSmallestTimeStep(series)).toBe(MINUTE);
  });
});

describe('getPlaceholderBarSeries', () => {
  it('splits the domain into evenly spaced positive bars', () => {
    let { series, intervalMs } = getPlaceholderBarSeries({ from: at(0), to: at(36) });
    let entries = series[0]!.entries;

    expect(intervalMs).toBe(MINUTE);
    expect(entries[0]!.key).toBe(at(0).getTime());
    expect(entries[1]!.key).toBe(at(1).getTime());
    expect(entries.every(entry => (entry.value ?? 0) > 0)).toBe(true);
  });
});

describe('getPlaceholderSeries', () => {
  it('spreads placeholder points across the domain', () => {
    let [placeholder] = getPlaceholderSeries({ from: at(0), to: at(55) });

    expect(placeholder.entries[0].key).toBe(at(0).getTime());
    expect(placeholder.entries[placeholder.entries.length - 1].key).toBe(at(55).getTime());
  });
});

describe('fillTimeBuckets', () => {
  let values = (series: ReturnType<typeof fillTimeBuckets>) =>
    series[0]!.entries.map(entry => [entry.key, entry.value]);

  it('fills missing buckets between points and across the domain', () => {
    let filled = fillTimeBuckets(
      [
        {
          id: 'a',
          name: 'A',
          entries: [
            { key: at(10), value: 3 },
            { key: at(13), value: 5 }
          ]
        }
      ],
      MINUTE,
      { from: at(9), to: at(15) }
    );

    expect(values(filled)).toEqual([
      [at(9), 0],
      [at(10), 3],
      [at(11), 0],
      [at(12), 0],
      [at(13), 5],
      [at(14), 0]
    ]);
  });

  it('aligns all series on the same buckets', () => {
    let filled = fillTimeBuckets(
      [
        { id: 'a', name: 'A', entries: [{ key: at(0), value: 1 }] },
        { id: 'b', name: 'B', entries: [{ key: at(2), value: 2 }] }
      ],
      MINUTE
    );

    expect(filled.map(item => item.entries.map(entry => entry.value))).toEqual([
      [1, 0, 0],
      [0, 0, 2]
    ]);
  });

  it('leaves series untouched when points are not on the step grid', () => {
    let series = [
      {
        id: 'a',
        name: 'A',
        entries: [
          { key: at(0), value: 1 },
          { key: new Date(at(0).getTime() + 30_000), value: 2 }
        ]
      }
    ];

    expect(fillTimeBuckets(series, MINUTE)).toBe(series);
  });
});
