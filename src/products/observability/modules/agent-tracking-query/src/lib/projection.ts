import {
  calendarDateKey,
  daysInMonth,
  monthKeyOf,
  shiftDays,
  type CalendarDate
} from './range';
import type {
  AgentTrackingProjectedMonth,
  AgentTrackingProjectionScenario,
  AgentTrackingSpendProjection,
  GrowthRateSource
} from './types';

export let baselineMaxDays = 30;

let baselineMinDays = 7;

let observedGrowthMinMonths = 3;

export let growthRateBounds = {
  input: { min: -0.5, max: 0.5 },
  observed: { min: -0.25, max: 0.25 }
};

let maxMicros = Number.MAX_SAFE_INTEGER;

export type ProjectionDay = { date: string; costMicros: number | null };

export type ProjectionMonth = { month: string; costMicros: number; hasHiddenDays?: boolean };

export let notApplicableProjection: AgentTrackingSpendProjection = {
  status: 'not_applicable',
  baseline: null,
  growth: null,
  scenarios: null
};

let monthOfKey = (month: string): CalendarDate => {
  let [year, number] = month.split('-').map(Number) as [number, number];
  return { year, month: number, day: 1 };
};

let clamp = (rate: number, bounds: { min: number; max: number }) =>
  Math.min(bounds.max, Math.max(bounds.min, rate));

let sumOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

let capped = (micros: number) => Math.max(-maxMicros, Math.min(maxMicros, micros));

// A hidden day (null) has no known cost, so it is left out of the average instead of counting
// as zero.
let baselineOf = (d: {
  today: CalendarDate;
  usageStart: string | null;
  days: ProjectionDay[];
}) => {
  let to = calendarDateKey(shiftDays(d.today, -1));
  if (!d.usageStart || d.usageStart > to) return null;

  let windowStart = calendarDateKey(shiftDays(d.today, -baselineMaxDays));
  let from = d.usageStart > windowStart ? d.usageStart : windowStart;
  let shown = d.days.flatMap(day =>
    day.date >= from && day.date <= to && day.costMicros !== null ? [day.costMicros] : []
  );

  return { from, to, days: shown.length, totalMicros: sumOf(shown) };
};

// Months differ in length, so months compare by their cost per day. The geometric mean keeps a
// rise and an equal fall from adding up to growth. A month without a positive, fully known cost
// cannot be compared, so both of its pairs are skipped; enough comparable pairs must remain.
let observedGrowthRate = (months: ProjectionMonth[], usageStart: string) => {
  let full = months.filter(month => `${month.month}-01` >= usageStart);
  if (full.length < observedGrowthMinMonths) return null;

  let perDay = full.map(month =>
    month.hasHiddenDays || month.costMicros <= 0
      ? null
      : month.costMicros / daysInMonth(monthOfKey(month.month))
  );
  let ratios = perDay.slice(1).flatMap((after, index) => {
    let before = perDay[index];
    return before && after ? [after / before] : [];
  });
  if (ratios.length < observedGrowthMinMonths - 1) return null;

  let product = ratios.reduce((total, ratio) => total * ratio, 1);
  return clamp(product ** (1 / ratios.length) - 1, growthRateBounds.observed);
};

let growthOf = (d: {
  growthRate?: number | null;
  usageStart: string;
  months: ProjectionMonth[];
}): { rate: number; source: GrowthRateSource } => {
  if (typeof d.growthRate == 'number') {
    return { rate: clamp(d.growthRate, growthRateBounds.input), source: 'input' };
  }

  let observed = observedGrowthRate(d.months.slice(0, -1), d.usageStart);
  return observed === null
    ? { rate: 0, source: 'default' }
    : { rate: observed, source: 'observed' };
};

// Month 0 is the current month: what is left of it after the actuals, without growth. Each later
// month grows by the rate once more than the month before.
let scenarioOf = (d: {
  today: CalendarDate;
  todayRemaining: number;
  currentMonthMicros: number;
  yearToDateMicros: number;
  dailyRateMicros: number;
  growthRate: number;
}): AgentTrackingProjectionScenario => {
  let monthsLeftThisYear = 13 - d.today.month;

  let months: AgentTrackingProjectedMonth[] = [];
  for (let offset = 0; offset < monthsLeftThisYear + 12; offset++) {
    let date = {
      year: d.today.year + Math.floor((d.today.month - 1 + offset) / 12),
      month: ((d.today.month - 1 + offset) % 12) + 1,
      day: 1
    };
    let days =
      offset == 0 ? daysInMonth(date) - d.today.day + d.todayRemaining : daysInMonth(date);
    let projectedMicros = capped(
      Math.round(d.dailyRateMicros * (1 + d.growthRate) ** offset * days)
    );
    let actualMicros = offset == 0 ? d.currentMonthMicros : 0;

    months.push({
      month: monthKeyOf(date),
      actualMicros,
      projectedMicros,
      totalMicros: capped(actualMicros + projectedMicros)
    });
  }

  let thisYear = months.slice(0, monthsLeftThisYear);
  let nextYear = months.slice(monthsLeftThisYear);

  return {
    growthRate: d.growthRate,
    months,
    yearEndTotalMicros: capped(
      d.yearToDateMicros + sumOf(thisYear.map(month => month.projectedMicros))
    ),
    nextYearTotalMicros: capped(sumOf(nextYear.map(month => month.totalMicros)))
  };
};

export let projectSpend = (d: {
  today: CalendarDate;
  todayRemaining: number;
  usageStart: string | null;
  days: ProjectionDay[];
  months: ProjectionMonth[];
  yearToDateMicros: number;
  growthRate?: number | null;
}): AgentTrackingSpendProjection => {
  let baseline = baselineOf(d);
  if (!baseline || !d.usageStart || baseline.days < baselineMinDays) {
    return {
      status: 'insufficient_data',
      baseline: baseline
        ? { from: baseline.from, to: baseline.to, days: baseline.days, dailyRateMicros: null }
        : null,
      growth: null,
      scenarios: null
    };
  }

  let dailyRateMicros = capped(Math.max(0, Math.round(baseline.totalMicros / baseline.days)));
  let growth = growthOf({ ...d, usageStart: d.usageStart });
  let scenario = (growthRate: number) =>
    scenarioOf({
      today: d.today,
      todayRemaining: Math.min(1, Math.max(0, d.todayRemaining)),
      currentMonthMicros: d.months.at(-1)?.costMicros ?? 0,
      yearToDateMicros: d.yearToDateMicros,
      dailyRateMicros,
      growthRate
    });

  return {
    status: 'projected',
    baseline: { from: baseline.from, to: baseline.to, days: baseline.days, dailyRateMicros },
    growth,
    scenarios: { flat: scenario(0), growth: scenario(growth.rate) }
  };
};
