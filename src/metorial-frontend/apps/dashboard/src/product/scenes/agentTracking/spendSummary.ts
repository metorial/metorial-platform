import { formatNumber, formatPercent } from '@metorial/chart';

let unchangedBelow = 0.0005;

let previousPeriodLabels: Record<string, string> = {
  today: 'yesterday up to this time',
  last_7_days: 'the same length of time before',
  last_30_days: 'the same length of time before',
  month_to_date: 'last month up to the same day',
  last_month: 'the month before'
};

export let costChange = (current: number | null, previous: number | null) => {
  if (current === null || previous === null || previous == 0) return null;

  return (current - previous) / previous;
};

export let formatChange = (change: number) => {
  if (Math.abs(change) < unchangedBelow) return 'No change';

  return `${change > 0 ? '↑' : '↓'} ${formatPercent(Math.abs(change))}`;
};

export let previousPeriodLabel = (preset: string | null) =>
  (preset && previousPeriodLabels[preset]) || 'the previous period';

export let describeSpendChange = (d: {
  current: number | null;
  previous: { totalMicros: number | null; isEstimate: boolean };
  preset: string | null;
  startsBeforeRetention: boolean;
  format: (micros: number, opts: { estimate: boolean }) => string;
}) => {
  if (d.startsBeforeRetention || d.current === null || d.previous.totalMicros === null) {
    return null;
  }

  let label = previousPeriodLabel(d.preset);
  let change = costChange(d.current, d.previous.totalMicros);

  if (change === null) {
    return { change: null, text: `Nothing spent ${d.preset == 'today' ? '' : 'in '}${label}` };
  }

  return {
    change: formatChange(change),
    text: `vs ${label} (${d.format(d.previous.totalMicros, { estimate: d.previous.isEstimate })})`
  };
};

let countCap = 10000;

export let formatCount = (count: number, capped: boolean) =>
  `${formatNumber(count)}${capped && count >= countCap ? '+' : ''}`;

export let costSplit = (cost: {
  totalMicros: number | null;
  billedMicros: number | null;
  estimatedMicros: number | null;
}) => {
  let billed = Math.max(0, cost.billedMicros ?? 0);
  let estimated = Math.max(0, cost.estimatedMicros ?? 0);
  let sum = billed + estimated;

  if (cost.totalMicros === null || sum <= 0) return null;

  return { billedShare: billed / sum, estimatedShare: estimated / sum };
};

export let hasUsage = (figures: {
  requests: number;
  tokens: { total: number };
  cost: { totalMicros: number | null };
}) => figures.requests > 0 || figures.tokens.total > 0 || (figures.cost.totalMicros ?? 0) != 0;
