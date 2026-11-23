import { describe, expect, it } from 'vitest';
import {
  growthRateBounds,
  projectSpend,
  type ProjectionDay,
  type ProjectionMonth
} from '../src/lib/projection';
import {
  calendarDateKey,
  daysInMonth,
  monthKeyOf,
  shiftDays,
  type CalendarDate
} from '../src/lib/range';
import type { AgentTrackingProjectionScenario } from '../src/lib/types';

let dollar = 1_000_000;

let fullDays = (today: CalendarDate, count: number, cost: (index: number) => number | null) =>
  Array.from({ length: count }, (_, index): ProjectionDay => ({
    date: calendarDateKey(shiftDays(today, index - count)),
    costMicros: cost(index)
  }));

let yearMonths = (today: CalendarDate, cost: (month: number) => number) =>
  Array.from({ length: today.month }, (_, index): ProjectionMonth => ({
    month: monthKeyOf({ year: today.year, month: index + 1, day: 1 }),
    costMicros: cost(index + 1)
  }));

let perDayMonths = (today: CalendarDate, perDay: (month: number) => number) =>
  yearMonths(today, month => perDay(month) * daysInMonth({ year: today.year, month, day: 1 }));

let sumOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

let project = (
  d: Partial<Parameters<typeof projectSpend>[0]> & {
    today: CalendarDate;
    months: ProjectionMonth[];
  }
) =>
  projectSpend({
    todayRemaining: 0,
    usageStart: null,
    days: [],
    yearToDateMicros: sumOf(d.months.map(month => month.costMicros)),
    ...d
  });

let expectConsistent = (
  scenario: AgentTrackingProjectionScenario,
  d: { year: number; actualSoFar: number }
) => {
  let thisYear = scenario.months.filter(month => month.month.startsWith(`${d.year}-`));
  let nextYear = scenario.months.filter(month => month.month.startsWith(`${d.year + 1}-`));

  expect(thisYear.length + nextYear.length).toBe(scenario.months.length);
  expect(nextYear).toHaveLength(12);
  for (let month of scenario.months) {
    expect(Number.isInteger(month.projectedMicros)).toBe(true);
    expect(month.totalMicros).toBe(month.actualMicros + month.projectedMicros);
  }

  expect(scenario.yearEndTotalMicros).toBe(
    d.actualSoFar + sumOf(thisYear.map(month => month.projectedMicros))
  );
  expect(scenario.nextYearTotalMicros).toBe(sumOf(nextYear.map(month => month.totalMicros)));
};

describe('projectSpend baseline', () => {
  let today = { year: 2026, month: 11, day: 22 };

  it('projects nothing with fewer than 7 days since usage started, but says what it has', () => {
    let projection = project({
      today,
      todayRemaining: 0.5,
      usageStart: '2026-11-16',
      days: fullDays(today, 30, () => dollar),
      months: yearMonths(today, () => 0)
    });

    expect(projection).toEqual({
      status: 'insufficient_data',
      baseline: { from: '2026-11-17', to: '2026-11-21', days: 5, dailyRateMicros: null },
      growth: null,
      scenarios: null
    });
  });

  it('has no baseline before a complete day after the first day with usage', () => {
    for (let usageStart of [null, '2026-11-22', '2026-11-21']) {
      let projection = project({
        today,
        todayRemaining: 0.5,
        usageStart,
        days: fullDays(today, 30, () => 0),
        months: yearMonths(today, () => 0)
      });

      expect(projection).toMatchObject({ status: 'insufficient_data', baseline: null });
    }
  });

  it('averages every day after the first day with usage when that is 7 to 29 days', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-11-12',
      days: fullDays(today, 30, index => (index >= 20 ? (index - 19) * dollar : 0)),
      months: yearMonths(today, month => (month == 11 ? 55 * dollar : 0))
    });

    expect(projection.status).toBe('projected');
    expect(projection.baseline).toEqual({
      from: '2026-11-13',
      to: '2026-11-21',
      days: 9,
      dailyRateMicros: 6 * dollar
    });
  });

  it('leaves out the partly recorded first day only when it falls in the window', () => {
    let days = fullDays(today, 31, index => (index == 1 ? 31 * dollar : dollar));

    let atWindowStart = project({
      today,
      usageStart: '2026-10-23',
      days,
      months: yearMonths(today, () => 0)
    });
    expect(atWindowStart.baseline).toEqual({
      from: '2026-10-24',
      to: '2026-11-21',
      days: 29,
      dailyRateMicros: dollar
    });

    let beforeWindow = project({
      today,
      usageStart: '2026-10-22',
      days,
      months: yearMonths(today, () => 0)
    });
    expect(beforeWindow.baseline).toEqual({
      from: '2026-10-23',
      to: '2026-11-21',
      days: 30,
      dailyRateMicros: 2 * dollar
    });

    let firstWeek = project({
      today,
      usageStart: '2026-11-14',
      days,
      months: yearMonths(today, () => 0)
    });
    expect(firstWeek).toMatchObject({
      status: 'projected',
      baseline: { from: '2026-11-15', days: 7 }
    });
  });

  it('averages the last 30 complete days once there are more', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-01-05',
      days: fullDays(today, 60, index => (index < 30 ? 100 * dollar : 2 * dollar)),
      months: yearMonths(today, () => 60 * dollar)
    });

    expect(projection.baseline).toEqual({
      from: '2026-10-23',
      to: '2026-11-21',
      days: 30,
      dailyRateMicros: 2 * dollar
    });
  });

  it('reaches back into the year before', () => {
    let january = { year: 2026, month: 1, day: 10 };
    let projection = project({
      today: january,
      todayRemaining: 1,
      usageStart: '2025-06-01',
      days: fullDays(january, 30, () => dollar),
      months: yearMonths(january, () => 9 * dollar)
    });

    expect(projection.baseline).toMatchObject({
      from: '2025-12-11',
      to: '2026-01-09',
      days: 30
    });
  });

  it('averages all 30 days when usage started the year before, quiet days included', () => {
    let february = { year: 2026, month: 2, day: 5 };
    let projection = project({
      today: february,
      usageStart: '2025-12-10',
      days: fullDays(february, 30, index => (index >= 14 ? 3 * dollar : 0)),
      months: yearMonths(february, () => 0)
    });

    expect(projection.baseline).toEqual({
      from: '2026-01-06',
      to: '2026-02-04',
      days: 30,
      dailyRateMicros: 1.6 * dollar
    });
  });

  it('leaves hidden days out of the average instead of counting them as zero', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-01-01',
      days: fullDays(today, 30, index => (index % 3 == 0 ? null : 3 * dollar)),
      months: yearMonths(today, () => 0)
    });

    expect(projection.baseline).toMatchObject({ days: 20, dailyRateMicros: 3 * dollar });
  });

  it('needs 7 shown days, not 7 calendar days', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-11-12',
      days: fullDays(today, 10, index => (index < 4 ? null : dollar)),
      months: yearMonths(today, () => 0)
    });

    expect(projection).toMatchObject({ status: 'insufficient_data', baseline: { days: 6 } });
  });

  it('projects zero for usage that cost nothing', () => {
    let projection = project({
      today,
      todayRemaining: 0.5,
      usageStart: '2026-11-01',
      days: fullDays(today, 30, () => 0),
      months: yearMonths(today, () => 0)
    });

    expect(projection.status).toBe('projected');
    expect(projection.baseline!.dailyRateMicros).toBe(0);
    for (let scenario of [projection.scenarios!.flat, projection.scenarios!.growth]) {
      expect(scenario.yearEndTotalMicros).toBe(0);
      expect(scenario.nextYearTotalMicros).toBe(0);
      expect(scenario.months.every(month => month.totalMicros == 0)).toBe(true);
    }
  });

  it('never projects a negative rate from credits', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-11-01',
      days: fullDays(today, 30, () => -dollar),
      months: yearMonths(today, () => 0)
    });

    expect(projection.baseline!.dailyRateMicros).toBe(0);
  });
});

describe('projectSpend growth', () => {
  let today = { year: 2026, month: 11, day: 22 };
  let days = fullDays(today, 30, () => dollar);

  it('uses no growth with fewer than 3 complete months since usage started', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-08-15',
      days,
      months: yearMonths(today, month => month * dollar)
    });

    expect(projection.growth).toEqual({ rate: 0, source: 'default' });
    expect(projection.scenarios!.growth).toEqual(projection.scenarios!.flat);
  });

  it('compares months by cost per day, so month length is not growth', () => {
    let may = { year: 2026, month: 5, day: 10 };
    let projection = project({
      today: may,
      usageStart: '2026-02-01',
      days: fullDays(may, 30, () => dollar),
      months: perDayMonths(may, month => (month == 1 ? 0 : dollar))
    });

    expect(projection.growth).toEqual({ rate: 0, source: 'observed' });
  });

  it('takes the geometric mean of the monthly changes', () => {
    let projection = project({
      today,
      usageStart: '2026-07-01',
      days,
      months: perDayMonths(today, month =>
        month == 8 ? 20 * dollar : month >= 7 && month <= 10 ? 10 * dollar : 0
      )
    });
    expect(projection.growth).toEqual({ rate: 0, source: 'observed' });

    let steady = project({
      today,
      usageStart: '2026-08-01',
      days,
      months: perDayMonths(today, month =>
        month == 8 ? 10 * dollar : month == 9 ? 11 * dollar : month == 10 ? 12.1 * dollar : 0
      )
    });
    expect(steady.growth!.source).toBe('observed');
    expect(steady.growth!.rate).toBeCloseTo(0.1, 10);
  });

  it('skips a change from a month without cost and clamps the result to the observed bounds', () => {
    expect(growthRateBounds.observed).toEqual({ min: -0.25, max: 0.25 });

    let fromZero = project({
      today,
      usageStart: '2026-01-01',
      days,
      months: perDayMonths(today, month => (month < 8 ? 0 : 50 ** (month - 8) * dollar))
    });
    expect(fromZero.growth).toEqual({ rate: 0.25, source: 'observed' });

    let onlyZeros = project({
      today,
      usageStart: '2026-01-01',
      days,
      months: yearMonths(today, () => 0)
    });
    expect(onlyZeros.growth).toEqual({ rate: 0, source: 'default' });

    let falling = project({
      today,
      usageStart: '2026-07-01',
      days,
      months: perDayMonths(today, month =>
        month < 11 ? (100 * dollar) / 10 ** (month - 7) : 0
      )
    });
    expect(falling.growth).toEqual({ rate: -0.25, source: 'observed' });

    let stopped = project({
      today,
      usageStart: '2026-08-01',
      days,
      months: perDayMonths(today, month => (month == 8 || month == 9 ? dollar : 0))
    });
    expect(stopped.growth).toEqual({ rate: 0, source: 'default' });
  });

  it('skips a month without cost on both sides, so usage that recovers is not a fall', () => {
    let june = { year: 2026, month: 6, day: 10 };
    let projection = project({
      today: june,
      usageStart: '2026-01-01',
      days: fullDays(june, 30, () => dollar),
      months: perDayMonths(june, month => (month == 3 ? 0 : 10 * dollar))
    });

    expect(projection.growth).toEqual({ rate: 0, source: 'observed' });
  });

  it('skips a month of credits like a month without cost', () => {
    let projection = project({
      today,
      usageStart: '2026-06-01',
      days,
      months: perDayMonths(today, month =>
        month == 8 ? -5 * dollar : month == 6 || month == 9 ? 10 * dollar : 11 * dollar
      )
    });

    expect(projection.growth!.source).toBe('observed');
    expect(projection.growth!.rate).toBeCloseTo(0.1, 10);
  });

  it('needs 2 comparable changes, not only 3 complete months', () => {
    let projection = project({
      today,
      usageStart: '2026-07-01',
      days,
      months: perDayMonths(today, month => (month == 8 ? 0 : 10 * dollar))
    });

    expect(projection.growth).toEqual({ rate: 0, source: 'default' });
  });

  it('leaves months with hidden days out of observed growth', () => {
    let months = perDayMonths(today, month => (month >= 9 ? 5 * dollar : 10 * dollar)).map(
      month => ({ ...month, hasHiddenDays: month.month == '2026-09' })
    );
    let projection = project({ today, usageStart: '2026-01-01', days, months });

    expect(projection.growth).toEqual({ rate: 0, source: 'observed' });

    let shown = project({
      today,
      usageStart: '2026-01-01',
      days,
      months: months.map(month => ({ ...month, hasHiddenDays: false }))
    });
    expect(shown.growth!.rate).toBeLessThan(0);
  });

  it('counts January as complete when usage started the year before', () => {
    let april = { year: 2026, month: 4, day: 10 };
    let months = perDayMonths(april, month =>
      month == 1 ? dollar : month == 2 ? 1.1 * dollar : month == 3 ? 1.21 * dollar : 0
    );

    let sinceDecember = project({
      today: april,
      usageStart: '2025-12-15',
      days: fullDays(april, 30, () => dollar),
      months
    });
    expect(sinceDecember.growth!.source).toBe('observed');
    expect(sinceDecember.growth!.rate).toBeCloseTo(0.1, 10);

    let sinceJanuary = project({
      today: april,
      usageStart: '2026-01-20',
      days: fullDays(april, 30, () => dollar),
      months
    });
    expect(sinceJanuary.growth).toEqual({ rate: 0, source: 'default' });
  });

  it('takes a growth rate it is given over the observed one', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-01-01',
      days,
      months: yearMonths(today, month => month * dollar),
      growthRate: 0.1
    });

    expect(projection.growth).toEqual({ rate: 0.1, source: 'input' });
    expect(projection.scenarios!.flat.growthRate).toBe(0);
    expect(projection.scenarios!.growth.growthRate).toBe(0.1);
  });

  it('compounds monthly from the month after the current one', () => {
    let projection = project({
      today,
      todayRemaining: 0,
      usageStart: '2026-01-01',
      days,
      months: yearMonths(today, () => 0),
      growthRate: 0.1
    });

    let [november, december, january] = projection.scenarios!.growth.months;
    expect(november).toMatchObject({ month: '2026-11', projectedMicros: 8 * dollar });
    expect(december).toMatchObject({
      month: '2026-12',
      projectedMicros: Math.round(31 * 1.1 * dollar)
    });
    expect(january!.month).toBe('2027-01');
    expect(january!.projectedMicros).toBe(Math.round(31 * 1.1 ** 2 * dollar));
  });
});

describe('projectSpend months and totals', () => {
  it('counts the rest of today and the days after it in the current month', () => {
    let today = { year: 2026, month: 11, day: 22 };
    let projection = project({
      today,
      todayRemaining: 0.25,
      usageStart: '2026-01-01',
      days: fullDays(today, 30, () => 4 * dollar),
      months: yearMonths(today, month => (month == 11 ? 90 * dollar : 100 * dollar))
    });

    let flat = projection.scenarios!.flat;
    expect(flat.months[0]).toEqual({
      month: '2026-11',
      actualMicros: 90 * dollar,
      projectedMicros: 8.25 * 4 * dollar,
      totalMicros: 123 * dollar
    });
    expect(flat.yearEndTotalMicros).toBe((1090 + 33 + 31 * 4) * dollar);
    expect(flat.nextYearTotalMicros).toBe(365 * 4 * dollar);

    expectConsistent(flat, { year: 2026, actualSoFar: 1090 * dollar });
    expectConsistent(projection.scenarios!.growth, { year: 2026, actualSoFar: 1090 * dollar });
  });

  it('has only the rest of December left in December', () => {
    let today = { year: 2026, month: 12, day: 31 };
    let projection = project({
      today,
      todayRemaining: 0.5,
      usageStart: '2026-01-01',
      days: fullDays(today, 30, () => 2 * dollar),
      months: yearMonths(today, () => 10 * dollar),
      growthRate: 0.2
    });

    let growth = projection.scenarios!.growth;
    expect(growth.months).toHaveLength(13);
    expect(growth.months[0]).toMatchObject({ month: '2026-12', projectedMicros: dollar });
    expect(growth.months[1]).toMatchObject({
      month: '2027-01',
      projectedMicros: Math.round(31 * 2 * 1.2 * dollar)
    });
    expect(growth.yearEndTotalMicros).toBe(121 * dollar);

    expectConsistent(growth, { year: 2026, actualSoFar: 120 * dollar });
  });

  it('counts 29 days in February of a leap year', () => {
    let beforeLeapYear = { year: 2027, month: 6, day: 30 };
    let flat = project({
      today: beforeLeapYear,
      todayRemaining: 1,
      usageStart: '2027-01-01',
      days: fullDays(beforeLeapYear, 30, () => dollar),
      months: yearMonths(beforeLeapYear, () => 0)
    }).scenarios!.flat;

    expect(flat.months.find(month => month.month == '2028-02')!.projectedMicros).toBe(
      29 * dollar
    );
    expect(flat.nextYearTotalMicros).toBe(366 * dollar);

    let inLeapYear = { year: 2028, month: 2, day: 10 };
    let current = project({
      today: inLeapYear,
      todayRemaining: 1,
      usageStart: '2027-01-01',
      days: fullDays(inLeapYear, 30, () => dollar),
      months: yearMonths(inLeapYear, () => 0)
    }).scenarios!.flat;

    expect(current.months[0]).toMatchObject({
      month: '2028-02',
      projectedMicros: 20 * dollar
    });
    expect(current.yearEndTotalMicros).toBe((366 - 40) * dollar);
    expect(current.months.find(month => month.month == '2029-02')!.projectedMicros).toBe(
      28 * dollar
    );
  });

  it('keeps every month whole micro-dollars and the totals their exact sums', () => {
    let today = { year: 2026, month: 3, day: 17 };
    let projection = project({
      today,
      todayRemaining: 0.3333,
      usageStart: '2026-01-01',
      days: fullDays(today, 30, index => 1_234_567 + index * 7_919),
      months: yearMonths(today, month => month * 3_333_333),
      growthRate: 0.037
    });

    for (let scenario of [projection.scenarios!.flat, projection.scenarios!.growth]) {
      expectConsistent(scenario, { year: 2026, actualSoFar: 6 * 3_333_333 });
    }
  });

  it('stops amounts at the largest safe integer', () => {
    let today = { year: 2026, month: 1, day: 15 };
    let projection = project({
      today,
      usageStart: '2025-12-01',
      days: fullDays(today, 30, () => 10 ** 13),
      months: yearMonths(today, () => 0),
      growthRate: growthRateBounds.input.max
    });

    let growth = projection.scenarios!.growth;
    let values = [
      growth.yearEndTotalMicros,
      growth.nextYearTotalMicros,
      ...growth.months.flatMap(month => [
        month.actualMicros,
        month.projectedMicros,
        month.totalMicros
      ])
    ];
    for (let value of values) expect(Number.isSafeInteger(value)).toBe(true);

    expect(growth.months[0]!.projectedMicros).toBe(16 * 10 ** 13);
    expect(growth.months.at(-1)!.projectedMicros).toBe(Number.MAX_SAFE_INTEGER);
    expect(growth.nextYearTotalMicros).toBe(Number.MAX_SAFE_INTEGER);
    expectConsistent(projection.scenarios!.flat, { year: 2026, actualSoFar: 0 });
  });
});
