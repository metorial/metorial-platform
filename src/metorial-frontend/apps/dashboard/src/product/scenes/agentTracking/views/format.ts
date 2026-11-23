import { formatNumber, formatPercent } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingMembersInsightsOutput } from '@metorial/dashboard-sdk';
import { formatCost } from '../costFormat';
import {
  isTeamViewKind,
  maxInsightMembers,
  teamViewDefinitions,
  type InsightFlag,
  type TeamViewKind
} from './definitions';

export type MemberInsights = DashboardInstanceAgentTrackingMembersInsightsOutput;

export type MemberInsight = MemberInsights['items'][number];

export type { InsightFlag };

type OutdatedModel = NonNullable<MemberInsight['practices']>['outdatedModels'][number];

type FlagCounts = MemberInsights['summary']['flagCounts'];

export let notReportedLabel = 'Not Reported';

let flagCountKeys: Record<InsightFlag, keyof FlagCounts> = {
  model_share: 'modelShare',
  high_effort: 'highEffort',
  fast_mode: 'fastMode',
  outdated_models: 'outdatedModels',
  low_cache_hit_rate: 'lowCacheHitRate',
  low_usage_seat: 'lowUsageSeat'
};

export let partOfCost = (
  micros: number | null | undefined,
  cost: { isEstimate: boolean }
) => ({
  totalMicros: micros ?? null,
  isEstimate: cost.isEstimate && !!micros
});

export let formatInsightShare = (share: number | null | undefined) => {
  if (share === null || share === undefined) return null;
  if (share > 0 && share < 0.005) return '<1%';

  return formatPercent(share, { precision: 0 });
};

export let flagCountOf = (summary: MemberInsights['summary'], flag: InsightFlag) =>
  summary.flagCounts[flagCountKeys[flag]];

export let outdatedModelStatusLabel = (model: Pick<OutdatedModel, 'status' | 'isLatest'>) => {
  if (model.status == 'retired') return 'Retired';
  if (model.status == 'deprecated') return 'Deprecated';
  if (model.isLatest === false) return 'Not Latest';

  return 'Outdated';
};

export let describeMaxEffort = (practices: NonNullable<MemberInsight['practices']>) =>
  practices.highEffortShare === null
    ? null
    : `${formatNumber(practices.maxEffortRequests)} at max effort`;

export let unknownKindLabel = 'Unknown Kind';

export let teamViewKindLabel = (kind: string) =>
  isTeamViewKind(kind) ? teamViewDefinitions[kind].label : unknownKindLabel;

export let truncatedNotice = (includeInactive: boolean) =>
  `More than ${formatNumber(maxInsightMembers)} members ${includeInactive ? 'are known to this instance' : 'had usage in this range'}. Only ${formatNumber(maxInsightMembers)} are listed${includeInactive ? ', members with usage first,' : ''} and the least expensive are left out. Ranks and flag counts cover only the members listed; the totals still cover everyone.`;

export let modelCatalogNotice =
  'Deprecated, retired and latest reflect the model catalog today, not when the requests were made.';

export let seatUsageNotice = 'An estimate at list prices, not a bill';

export let membersWithoutUsageNotice = (days: number) =>
  `The instance's consumers and the people seen in it in the last ${formatNumber(days)} days who have no usage in this range.`;

let practiceSummaries = [
  { label: 'High Effort', share: 'highEffortShare', flag: 'high_effort' },
  { label: 'Fast Mode', share: 'fastShare', flag: 'fast_mode' },
  { label: 'Outdated Models', share: 'outdatedShare', flag: 'outdated_models' },
  { label: 'Cache Hit Rate', share: 'cacheHitRate', flag: 'low_cache_hit_rate' }
] as const;

let counted = (count: number, one: string, many = `${one}s`) =>
  `${formatNumber(count)} ${count == 1 ? one : many}`;

let withSuffix = (value: string | null, suffix: string) =>
  value === null ? null : `${value} ${suffix}`;

let costText = (cost: { totalMicros: number | null; isEstimate: boolean }, suffix: string) =>
  withSuffix(formatCost(cost.totalMicros, { estimate: cost.isEstimate }), suffix);

let flaggedText = (count: number | null) => (count ? `${formatNumber(count)} flagged` : null);

let summaryParts = (kind: TeamViewKind, summary: MemberInsights['summary']) => {
  let { practices, models, seat } = summary;

  if (kind == 'practices' && practices) {
    return [
      counted(summary.members, 'member'),
      ...practiceSummaries.map(item => {
        let share = formatInsightShare(practices[item.share]);
        if (share === null) return null;

        let flagged = flaggedText(flagCountOf(summary, item.flag));
        return `${item.label} ${share}${flagged ? `, ${flagged}` : ''}`;
      })
    ];
  }

  if (kind == 'by_model' && models) {
    return [
      costText(partOfCost(models.costMicros, summary.cost), 'on the selected models'),
      withSuffix(formatInsightShare(models.costShare), 'of all cost'),
      counted(summary.members, 'ranked member'),
      flaggedText(summary.flagCounts.modelShare)
    ];
  }

  if (kind == 'seats' && seat) {
    let listPrice = summary.cost.listPriceMicros;

    return [
      counted(summary.members, 'member'),
      `${formatNumber(summary.flagCounts.lowUsageSeat ?? 0)} with low usage`,
      `${formatNumber(seat.unknownSeatMembers)} with no seat reported`,
      withSuffix(formatCost(listPrice, { estimate: !!listPrice }), 'at list price')
    ];
  }

  return [
    costText(summary.cost, 'in the range'),
    counted(summary.activeMembers, 'active member'),
    counted(summary.sessions, 'session with usage', 'sessions with usage'),
    counted(summary.requests, 'request')
  ];
};

export let describeInsightsSummary = (
  kind: TeamViewKind,
  summary: MemberInsights['summary']
) =>
  summaryParts(kind, summary)
    .filter(part => !!part)
    .join(' · ');

export let describeModelListSummary = (breakdown: {
  total: { cost: { totalMicros: number | null; isEstimate: boolean } };
  items: { kind: string }[];
}) =>
  [
    costText(breakdown.total.cost, 'in the range'),
    counted(breakdown.items.filter(item => item.kind != 'other').length, 'model')
  ]
    .filter(part => !!part)
    .join(' · ');
