import { describe, expect, it } from 'vitest';
import {
  currentYearIn,
  describeCoverage,
  describeCoverageDays,
  formatDay,
  formatMonth,
  growthSourceText,
  hasReportCost,
  parseGrowthPercent,
  reportChartMonths,
  type SpendReport
} from './reportSummary';

let report = (d: {
  coverage?: Partial<SpendReport['coverage']>;
  hideIndividuals?: boolean;
  startsBeforeRetention?: boolean;
  past?: boolean;
}) =>
  ({
    year: 2026,
    startsBeforeRetention: d.startsBeforeRetention ?? false,
    privacy: {
      hideIndividuals: d.hideIndividuals ?? false,
      minGroupUsers: 5,
      hiddenGroups: false
    },
    coverage: {
      firstDay: '2026-11-15',
      daysWithData: 7,
      hiddenDays: 0,
      startsBeforeYear: false,
      lastFullDay: '2026-11-21',
      ...d.coverage
    },
    projection: { status: d.past ? 'not_applicable' : 'projected' }
  }) as SpendReport;

describe('formatDay and formatMonth', () => {
  it('formats calendar keys without shifting them into another time zone', () => {
    expect(formatDay('2026-03-02')).toBe('Mar 2, 2026');
    expect(formatDay('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatMonth('2027-12')).toBe('Dec 2027');
  });
});

describe('currentYearIn', () => {
  it('reads the year in the given time zone', () => {
    let newYearUtc = new Date('2027-01-01T03:00:00Z');

    expect(currentYearIn('UTC', newYearUtc)).toBe(2027);
    expect(currentYearIn('America/Los_Angeles', newYearUtc)).toBe(2026);
  });
});

describe('parseGrowthPercent', () => {
  it('reads a percent and keeps it within the bounds', () => {
    expect(parseGrowthPercent('5')).toBe(5);
    expect(parseGrowthPercent('-2.5')).toBe(-2.5);
    expect(parseGrowthPercent('80')).toBe(50);
    expect(parseGrowthPercent('-80')).toBe(-50);
  });

  it('ignores a missing or invalid value', () => {
    expect(parseGrowthPercent(null)).toBeUndefined();
    expect(parseGrowthPercent('')).toBeUndefined();
    expect(parseGrowthPercent('abc')).toBeUndefined();
  });
});

describe('growthSourceText', () => {
  it('names where the growth rate comes from', () => {
    expect(growthSourceText({ rate: 0.0321, source: 'observed' })).toBe(
      'observed trend, 3.21% per month'
    );
    expect(growthSourceText({ rate: 0.05, source: 'input' })).toBe('set by you, 5% per month');
    expect(growthSourceText({ rate: 0, source: 'default' })).toBe('no trend yet, 0%');
  });
});

describe('describeCoverage', () => {
  it('says when the data starts during the year', () => {
    expect(describeCoverage(report({}))).toEqual({
      partial: true,
      sentences: [
        'Data starts on Nov 15, 2026, so the totals cover usage from then on, not the whole year.',
        '7 days with usage through today (Nov 22, 2026), which is still in progress.'
      ]
    });
  });

  it('only counts the days when usage started before the year', () => {
    expect(
      describeCoverage(
        report({ coverage: { startsBeforeYear: true, firstDay: '2026-01-01' } })
      )
    ).toEqual({
      partial: false,
      sentences: [
        '7 days with usage through today (Nov 22, 2026), which is still in progress.'
      ]
    });
  });

  it('counts today in the current year without claiming it has usage', () => {
    expect(describeCoverageDays(report({ coverage: { daysWithData: 1 } }))).toBe(
      '1 day with usage through today (Nov 22, 2026), which is still in progress.'
    );
    expect(describeCoverageDays(report({ coverage: { lastFullDay: '2026-11-30' } }))).toBe(
      '7 days with usage through today (Dec 1, 2026), which is still in progress.'
    );
  });

  it('names January 1 as today when there is no full day yet', () => {
    expect(
      describeCoverageDays(
        report({ coverage: { firstDay: '2026-01-01', daysWithData: 1, lastFullDay: null } })
      )
    ).toBe('1 day with usage through today (Jan 1, 2026), which is still in progress.');
  });

  it('leaves out today when individuals are hidden', () => {
    expect(describeCoverage(report({ hideIndividuals: true })).sentences[1]).toBe(
      '7 days with usage through Nov 21, 2026, not counting today.'
    );
  });

  it('counts the whole of a past year', () => {
    expect(
      describeCoverage(
        report({ past: true, coverage: { firstDay: '2026-01-05', lastFullDay: '2026-12-31' } })
      ).sentences[1]
    ).toBe('7 days with usage in 2026.');
  });

  it('says when there is no usage yet', () => {
    expect(
      describeCoverage(report({ coverage: { firstDay: null, daysWithData: 0 } }))
    ).toEqual({
      partial: true,
      sentences: ['No usage in 2026 yet.']
    });
    expect(
      describeCoverage(report({ coverage: { firstDay: null, daysWithData: 0 }, past: true }))
        .sentences
    ).toEqual(['No usage in 2026.']);
  });

  it('mentions hidden days and retention', () => {
    let coverage = describeCoverage(
      report({
        coverage: { startsBeforeYear: true, hiddenDays: 2 },
        startsBeforeRetention: true
      })
    );

    expect(coverage.partial).toBe(true);
    expect(coverage.sentences.slice(1)).toEqual([
      '2 days are hidden because fewer than 5 people were active on them; the totals leave them out.',
      'Usage is kept for 400 days, so the start of 2026 is no longer available and the totals cover less than the whole year.'
    ]);
  });
});

describe('reportChartMonths', () => {
  it('adds the projected rest of the current month and the months after it', () => {
    let months = reportChartMonths(
      {
        months: [
          { month: '2026-11', cost: { billedMicros: 1, estimatedMicros: 2 } },
          { month: '2026-12', cost: { billedMicros: 3, estimatedMicros: 4 } }
        ]
      } as SpendReport,
      {
        growthRate: 0,
        yearEndTotalMicros: 0,
        nextYearTotalMicros: 0,
        months: [
          { month: '2026-12', actualMicros: 7, projectedMicros: 10, totalMicros: 17 },
          { month: '2027-01', actualMicros: 0, projectedMicros: 20, totalMicros: 20 }
        ]
      }
    );

    expect(months).toEqual([
      { month: '2026-11', billedMicros: 1, estimatedMicros: 2, projectedMicros: null },
      { month: '2026-12', billedMicros: 3, estimatedMicros: 4, projectedMicros: 10 },
      { month: '2027-01', billedMicros: null, estimatedMicros: null, projectedMicros: 20 }
    ]);
  });
});

describe('hasReportCost', () => {
  it('is false when every month is zero or unknown', () => {
    let month = (
      billed: number | null,
      estimated: number | null,
      projected: number | null
    ) => ({
      month: '2025-01',
      billedMicros: billed,
      estimatedMicros: estimated,
      projectedMicros: projected
    });

    expect(hasReportCost([month(0, 0, null), month(null, null, null)])).toBe(false);
    expect(hasReportCost([month(0, 0, null), month(null, 5, null)])).toBe(true);
    expect(hasReportCost([month(0, 0, 0), month(null, null, 7)])).toBe(true);
  });
});
