import { canonicalize } from '@lowerdeck/canonicalize';
import { formatNumber, formatPercent } from '@metorial/chart';

let unchangedBelow = 0.0005;

let previousPeriodLabels: Record<string, string> = {
  today: 'yesterday up to this time',
  last_7_days: 'the same length of time before',
  last_30_days: 'the same length of time before',
  month_to_date: 'last month up to the same day',
  last_month: 'the month before'
};

type SpendCounts = { sessions: number; members: number; capped: boolean } | null;

export type BreakdownGroup =
  'model' | 'client' | 'member' | 'repository' | 'branch' | 'ticket';

let breakdownOthersLabels: Partial<Record<BreakdownGroup, string>> = {
  model: 'Other Models',
  client: 'Other Clients',
  repository: 'Other Repositories',
  branch: 'Other Branches',
  ticket: 'Other Tickets'
};

export let unknownModelLabel = 'Unknown Model';

export let unknownClientLabel = 'Unknown Client';

export let unknownRepositoryLabel = 'Unknown Repository';

export let hiddenCountsNotice =
  'Sessions and Active Members are not shown, as distinct counts cannot be limited to the days shown.';

export let counted = (count: number, one: string, many = `${one}s`) =>
  `${formatNumber(count)} ${count == 1 ? one : many}`;

export let formatRequests = (count: number) => counted(count, 'request');

export let formatUnpricedRequests = (count: number) =>
  `${formatRequests(count)} without a known cost`;

export let memberName = (member: { name: string | null; email: string | null } | null) =>
  member ? (member.name ?? member.email ?? 'Unknown Member') : 'Unknown Member';

export let modelLabel = (model: { id: string; name: string | null }) => model.name ?? model.id;

export let clientLabel = (client: { name: string | null; family: string }) =>
  client.name ?? client.family;

export let isZero = (micros: number | null) => (micros ?? 0) == 0;

export let isLoadedFor = (loader: { input: unknown }, input: object | null) =>
  !!input && canonicalize(loader.input) == canonicalize(input);

export let breakdownOthersCount = (
  counts: SpendCounts | undefined,
  items: { kind: string }[]
) => {
  let listedMembers = items.filter(item => item.kind == 'member').length;

  return counts && !counts.capped && counts.members > listedMembers
    ? counts.members - listedMembers
    : null;
};

export let breakdownOthersLabel = (group: BreakdownGroup, others: number | null) =>
  breakdownOthersLabels[group] ??
  (others ? `${formatNumber(others)} Others` : 'Everyone Else');

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

export let hiddenGroupText = (minGroupUsers: number) => `fewer than ${minGroupUsers} people`;

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
