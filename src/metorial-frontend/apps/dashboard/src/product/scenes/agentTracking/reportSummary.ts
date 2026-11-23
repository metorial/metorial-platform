import { formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSpendReportOutput } from '@metorial/dashboard-sdk';
import { hasUsage, hiddenGroupText } from './spendSummary';

// Matches growthRateBounds.input of the agent-tracking-query module, in percent.
export let growthPercentBounds = { min: -50, max: 50 };

export let projectionMinDays = 7;

let retentionDays = 400;

export type SpendReport = DashboardInstanceAgentTrackingSpendReportOutput;

export type ProjectionScenario = NonNullable<SpendReport['projection']['scenarios']>['flat'];

export type GrowthSource = NonNullable<SpendReport['projection']['growth']>['source'];

export type ReportBreakdownGroup = keyof SpendReport['breakdowns'];

export let growthSourceLabels: Record<GrowthSource, string> = {
  input: 'set by you',
  observed: 'observed trend',
  default: 'no trend yet'
};

export let unknownClientLabel = 'Unknown Client';

export let projectionEstimateNote =
  'Projections are estimates. Usage no provider bill covers, such as a Claude subscription, is valued at your contract prices where set, else at the cost Claude Code reports or list prices, not at an amount billed.';

let dayFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

let monthFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});

let plural = (count: number, one: string, many: string) =>
  `${formatNumber(count)} ${count == 1 ? one : many}`;

export let formatDay = (day: string) => {
  let [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return dayFormat.format(new Date(Date.UTC(year, month - 1, date)));
};

export let formatMonth = (month: string) => {
  let [year, number] = month.split('-').map(Number) as [number, number];
  return monthFormat.format(new Date(Date.UTC(year, number - 1, 1)));
};

export let currentYearIn = (timeZone: string, now = new Date()) => {
  try {
    return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(now));
  } catch {
    return now.getUTCFullYear();
  }
};

export let growthPercentOf = (rate: number) => Number((rate * 100).toFixed(2));

export let clampGrowthPercent = (percent: number) =>
  Math.min(growthPercentBounds.max, Math.max(growthPercentBounds.min, percent));

export let parseGrowthPercent = (value: string | null) => {
  if (value === null || value.trim() == '') return undefined;

  let percent = Number(value);
  return Number.isFinite(percent) ? clampGrowthPercent(percent) : undefined;
};

export let growthSourceText = (growth: { rate: number; source: GrowthSource }) =>
  `${growthSourceLabels[growth.source]}, ${growth.source == 'default' ? '0%' : `${growthPercentOf(growth.rate)}% per month`}`;

export let isPastYear = (report: SpendReport) => report.projection.status == 'not_applicable';

export let reportTotalLabel = (report: SpendReport) =>
  isPastYear(report) ? `${report.year} Total` : 'Year to Date';

export let hasReportCost = (months: ReturnType<typeof reportChartMonths>) =>
  months.some(
    month =>
      (month.billedMicros ?? 0) != 0 ||
      (month.estimatedMicros ?? 0) != 0 ||
      (month.projectedMicros ?? 0) != 0
  );

let dayAfter = (day: string) => {
  let [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
};

export let isEmptyReport = (report: SpendReport) =>
  !hasUsage(report.total) &&
  !report.coverage.firstDay &&
  report.coverage.daysWithData == 0 &&
  report.coverage.hiddenDays == 0 &&
  !report.privacy.hiddenGroups;

export let describeCoverageDays = (report: SpendReport) => {
  let coverage = report.coverage;
  if (!coverage.firstDay) return null;

  let days = `${plural(coverage.daysWithData, 'day', 'days')} with usage`;

  if (isPastYear(report)) return `${days} in ${report.year}.`;

  if (!report.privacy.hideIndividuals) {
    let today = coverage.lastFullDay ? dayAfter(coverage.lastFullDay) : `${report.year}-01-01`;
    return `${days} through today (${formatDay(today)}), which is still in progress.`;
  }

  return coverage.lastFullDay
    ? `${days} through ${formatDay(coverage.lastFullDay)}, not counting today.`
    : `${days}.`;
};

export let describeCoverage = (report: SpendReport) => {
  let coverage = report.coverage;
  let hiddenDays = coverage.hiddenDays;

  let start = coverage.firstDay
    ? coverage.startsBeforeYear
      ? null
      : `Data starts on ${formatDay(coverage.firstDay)}, so the totals cover usage from then on, not the whole year.`
    : `No usage in ${report.year}${isPastYear(report) ? '' : ' yet'}.`;

  let days = describeCoverageDays(report);

  let hidden = hiddenDays
    ? `${plural(hiddenDays, 'day is', 'days are')} hidden because ${hiddenGroupText(report.privacy.minGroupUsers)} were active on ${hiddenDays == 1 ? 'it' : 'them'}; the totals leave ${hiddenDays == 1 ? 'it' : 'them'} out.`
    : null;

  let retention = report.startsBeforeRetention
    ? `Usage is kept for ${retentionDays} days, so the start of ${report.year} is no longer available and the totals cover less than the whole year.`
    : null;

  return {
    partial: !!(start || hidden || retention),
    sentences: [start, days, hidden, retention].filter((text): text is string => !!text)
  };
};

export let reportChartMonths = (report: SpendReport, scenario: ProjectionScenario | null) => {
  let projected = new Map(scenario?.months.map(month => [month.month, month]) ?? []);

  let actual = report.months.map(month => ({
    month: month.month,
    billedMicros: month.cost.billedMicros,
    estimatedMicros: month.cost.estimatedMicros,
    projectedMicros: projected.get(month.month)?.projectedMicros ?? null
  }));

  let known = new Set(actual.map(month => month.month));
  let future = (scenario?.months ?? [])
    .filter(month => !known.has(month.month))
    .map(month => ({
      month: month.month,
      billedMicros: null,
      estimatedMicros: null,
      projectedMicros: month.projectedMicros
    }));

  return [...actual, ...future];
};
