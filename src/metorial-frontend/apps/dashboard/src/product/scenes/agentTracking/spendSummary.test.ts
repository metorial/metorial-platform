import { describe, expect, it } from 'vitest';
import { formatAmount } from './costFormat';
import {
  breakdownOthersLabel,
  costChange,
  costSplit,
  describeSpendChange,
  formatChange,
  formatCount,
  hasUsage,
  previousPeriodLabel
} from './spendSummary';

let change = (d: {
  current: number | null;
  previous: number | null;
  preset?: string | null;
  isEstimate?: boolean;
  startsBeforeRetention?: boolean;
}) =>
  describeSpendChange({
    current: d.current,
    previous: { totalMicros: d.previous, isEstimate: d.isEstimate ?? true },
    preset: d.preset === undefined ? 'last_30_days' : d.preset,
    startsBeforeRetention: d.startsBeforeRetention ?? false,
    format: formatAmount
  });

describe('costChange', () => {
  it('is the change against the previous period', () => {
    expect(costChange(4812400000, 4102770000)).toBeCloseTo(0.17297, 4);
    expect(costChange(50000000, 100000000)).toBe(-0.5);
  });

  it('has no change when either side is missing or the previous period is zero', () => {
    expect(costChange(null, 10000000)).toBeNull();
    expect(costChange(10000000, null)).toBeNull();
    expect(costChange(10000000, 0)).toBeNull();
  });
});

describe('formatChange', () => {
  it('shows the direction and the size', () => {
    expect(formatChange(0.173)).toBe('↑ 17.3%');
    expect(formatChange(-0.05)).toBe('↓ 5%');
    expect(formatChange(0.0001)).toBe('No change');
  });
});

describe('describeSpendChange', () => {
  it('describes the change and the previous total', () => {
    expect(change({ current: 4812400000, previous: 4102770000 })).toEqual({
      change: '↑ 17.3%',
      text: 'vs the same length of time before (~$4,102.77)'
    });

    expect(change({ current: 10000000, previous: 20000000, isEstimate: false })?.text).toBe(
      'vs the same length of time before ($20.00)'
    );
  });

  it('shows no percentage when the previous period spent nothing', () => {
    expect(change({ current: 10000000, previous: 0, preset: 'today' })).toEqual({
      change: null,
      text: 'Nothing spent yesterday up to this time'
    });

    expect(change({ current: 10000000, previous: 0, preset: 'last_month' })?.text).toBe(
      'Nothing spent in the month before'
    );
  });

  it('shows nothing when a total is unknown or the previous period is cut by retention', () => {
    expect(change({ current: null, previous: 10000000 })).toBeNull();
    expect(change({ current: 10000000, previous: null })).toBeNull();
    expect(
      change({ current: 10000000, previous: 5000000, startsBeforeRetention: true })
    ).toBeNull();
  });

  it('names the previous period of each range', () => {
    expect(previousPeriodLabel('last_7_days')).toBe('the same length of time before');
    expect(previousPeriodLabel('last_30_days')).toBe('the same length of time before');
    expect(previousPeriodLabel('month_to_date')).toBe('last month up to the same day');
    expect(previousPeriodLabel('last_month')).toBe('the month before');
    expect(previousPeriodLabel(null)).toBe('the previous period');
  });
});

describe('formatCount', () => {
  it('marks a capped count as a lower bound', () => {
    expect(formatCount(10000, true)).toBe('10,000+');
    expect(formatCount(1936, false)).toBe('1,936');
  });

  it('leaves counts below the cap exact even when the other count was capped', () => {
    expect(formatCount(23, true)).toBe('23');
  });
});

describe('costSplit', () => {
  it('splits the total into billed and estimated shares', () => {
    let split = costSplit({
      totalMicros: 4812400000,
      billedMicros: 1240150000,
      estimatedMicros: 3572250000
    });

    expect(split?.billedShare).toBeCloseTo(0.2577, 3);
    expect(split?.estimatedShare).toBeCloseTo(0.7423, 3);
  });

  it('reads a missing part as zero', () => {
    expect(
      costSplit({ totalMicros: 5000000, billedMicros: null, estimatedMicros: 5000000 })
    ).toEqual({
      billedShare: 0,
      estimatedShare: 1
    });
  });

  it('has no split without a total or with nothing spent', () => {
    expect(
      costSplit({ totalMicros: null, billedMicros: null, estimatedMicros: null })
    ).toBeNull();
    expect(costSplit({ totalMicros: 0, billedMicros: 0, estimatedMicros: 0 })).toBeNull();
  });
});

describe('hasUsage', () => {
  let figures = (requests: number, tokens: number, cost: number | null) => ({
    requests,
    tokens: { total: tokens },
    cost: { totalMicros: cost }
  });

  it('counts requests, tokens or a cost that is not zero', () => {
    expect(hasUsage(figures(0, 0, 0))).toBe(false);
    expect(hasUsage(figures(0, 0, null))).toBe(false);
    expect(hasUsage(figures(1, 0, 0))).toBe(true);
    expect(hasUsage(figures(0, 12, 0))).toBe(true);
    expect(hasUsage(figures(0, 0, 250000))).toBe(true);
    expect(hasUsage(figures(0, 0, -250000))).toBe(true);
  });
});

describe('breakdownOthersLabel', () => {
  it('names the rest of a breakdown by its group', () => {
    expect(
      (['repository', 'branch', 'ticket'] as const).map(group =>
        breakdownOthersLabel(group, 3)
      )
    ).toEqual(['Other Repositories', 'Other Branches', 'Other Tickets']);
    expect(breakdownOthersLabel('member', 3)).toBe('3 Others');
    expect(breakdownOthersLabel('member', null)).toBe('Everyone Else');
  });
});
