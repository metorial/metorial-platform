import { describe, expect, it } from 'vitest';
import { formatAmount } from './costFormat';
import {
  costChange,
  costSplit,
  describeSpendChange,
  formatChange,
  formatCount,
  hasUsage,
  previousPeriodLabel
} from './spendSummary';

let change = (d: {
  current: string | null;
  previous: string | null;
  preset?: string | null;
  isEstimate?: boolean;
  startsBeforeRetention?: boolean;
}) =>
  describeSpendChange({
    current: d.current,
    previous: { total: d.previous, isEstimate: d.isEstimate ?? true },
    preset: d.preset === undefined ? 'last_30_days' : d.preset,
    startsBeforeRetention: d.startsBeforeRetention ?? false,
    format: formatAmount
  });

describe('costChange', () => {
  it('is the change against the previous period', () => {
    expect(costChange('4812.40', '4102.77')).toBeCloseTo(0.17297, 4);
    expect(costChange('50', '100')).toBe(-0.5);
  });

  it('has no change when either side is missing or the previous period is zero', () => {
    expect(costChange(null, '10')).toBeNull();
    expect(costChange('10', null)).toBeNull();
    expect(costChange('10', '0')).toBeNull();
    expect(costChange('10', '0.000000000')).toBeNull();
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
    expect(change({ current: '4812.40', previous: '4102.77' })).toEqual({
      change: '↑ 17.3%',
      text: 'vs the same length of time before (~$4,102.77)'
    });

    expect(change({ current: '10', previous: '20', isEstimate: false })?.text).toBe(
      'vs the same length of time before ($20.00)'
    );
  });

  it('shows no percentage when the previous period spent nothing', () => {
    expect(change({ current: '10', previous: '0', preset: 'today' })).toEqual({
      change: null,
      text: 'Nothing spent yesterday up to this time'
    });

    expect(change({ current: '10', previous: '0', preset: 'last_month' })?.text).toBe(
      'Nothing spent in the month before'
    );
  });

  it('shows nothing when a total is unknown or the previous period is cut by retention', () => {
    expect(change({ current: null, previous: '10' })).toBeNull();
    expect(change({ current: '10', previous: null })).toBeNull();
    expect(change({ current: '10', previous: '5', startsBeforeRetention: true })).toBeNull();
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
    let split = costSplit({ total: '4812.40', billed: '1240.15', estimated: '3572.25' });

    expect(split?.billedShare).toBeCloseTo(0.2577, 3);
    expect(split?.estimatedShare).toBeCloseTo(0.7423, 3);
  });

  it('reads a missing part as zero', () => {
    expect(costSplit({ total: '5', billed: null, estimated: '5' })).toEqual({
      billedShare: 0,
      estimatedShare: 1
    });
  });

  it('has no split without a total or with nothing spent', () => {
    expect(costSplit({ total: null, billed: null, estimated: null })).toBeNull();
    expect(costSplit({ total: '0', billed: '0', estimated: '0' })).toBeNull();
  });
});

describe('hasUsage', () => {
  let figures = (requests: number, tokens: number, cost: string | null) => ({
    requests,
    tokens: { total: tokens },
    cost: { total: cost }
  });

  it('counts requests, tokens or a cost that is not zero', () => {
    expect(hasUsage(figures(0, 0, '0'))).toBe(false);
    expect(hasUsage(figures(0, 0, null))).toBe(false);
    expect(hasUsage(figures(1, 0, '0'))).toBe(true);
    expect(hasUsage(figures(0, 12, '0'))).toBe(true);
    expect(hasUsage(figures(0, 0, '0.25'))).toBe(true);
    expect(hasUsage(figures(0, 0, '-0.25'))).toBe(true);
  });
});
