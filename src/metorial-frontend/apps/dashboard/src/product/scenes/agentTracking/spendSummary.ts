import { formatNumber, formatPercent } from '@metorial/chart';

let unchangedBelow = 0.0005;

let previousPeriodLabels: Record<string, string> = {
  today: 'yesterday up to this time',
  last_7_days: 'the same length of time before',
  last_30_days: 'the same length of time before',
  month_to_date: 'last month up to the same day',
  last_month: 'the month before'
};

export let costChange = (current: string | null, previous: string | null) => {
  if (current === null || previous === null) return null;

  let currentAmount = Number(current);
  let previousAmount = Number(previous);
  if (!Number.isFinite(currentAmount) || !Number.isFinite(previousAmount)) return null;
  if (previousAmount == 0) return null;

  return (currentAmount - previousAmount) / previousAmount;
};

export let formatChange = (change: number) => {
  if (Math.abs(change) < unchangedBelow) return 'No change';

  return `${change > 0 ? '↑' : '↓'} ${formatPercent(Math.abs(change))}`;
};

export let previousPeriodLabel = (preset: string | null) =>
  (preset && previousPeriodLabels[preset]) || 'the previous period';

export let describeSpendChange = (d: {
  current: string | null;
  previous: { total: string | null; isEstimate: boolean };
  preset: string | null;
  startsBeforeRetention: boolean;
  format: (amount: string, opts: { estimate: boolean }) => string;
}) => {
  if (d.startsBeforeRetention || d.current === null || d.previous.total === null) return null;

  let label = previousPeriodLabel(d.preset);
  let change = costChange(d.current, d.previous.total);

  if (change === null) {
    return { change: null, text: `Nothing spent ${d.preset == 'today' ? '' : 'in '}${label}` };
  }

  return {
    change: formatChange(change),
    text: `vs ${label} (${d.format(d.previous.total, { estimate: d.previous.isEstimate })})`
  };
};

let countCap = 10000;

export let formatCount = (count: number, capped: boolean) =>
  `${formatNumber(count)}${capped && count >= countCap ? '+' : ''}`;

export let costSplit = (cost: {
  total: string | null;
  billed: string | null;
  estimated: string | null;
}) => {
  let billed = Math.max(0, Number(cost.billed ?? 0));
  let estimated = Math.max(0, Number(cost.estimated ?? 0));
  let sum = billed + estimated;

  if (cost.total === null || !Number.isFinite(sum) || sum <= 0) return null;

  return { billedShare: billed / sum, estimatedShare: estimated / sum };
};

export let hasUsage = (figures: {
  requests: number;
  tokens: { total: number };
  cost: { total: string | null };
}) =>
  figures.requests > 0 ||
  figures.tokens.total > 0 ||
  (figures.cost.total !== null && Number(figures.cost.total) != 0);
