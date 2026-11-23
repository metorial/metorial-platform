import { formatNumber, formatPercent } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingMembersInsightsOutput } from '@metorial/dashboard-sdk';
import { isTeamViewKind, maxInsightMembers, teamViewDefinitions } from './definitions';

export type MemberInsights = DashboardInstanceAgentTrackingMembersInsightsOutput;

export type MemberInsight = MemberInsights['items'][number];

export type InsightFlag = MemberInsight['flags'][number];

type OutdatedModel = NonNullable<MemberInsight['practices']>['outdatedModels'][number];

type FlagCounts = MemberInsights['summary']['flagCounts'];

export let notReportedLabel = 'Not Reported';

export let insightFlagLabels: Record<InsightFlag, string> = {
  model_share: 'High Model Share',
  high_effort: 'High Effort',
  fast_mode: 'Fast Mode',
  outdated_models: 'Outdated Models',
  low_cache_hit_rate: 'Low Cache Hits',
  low_usage_seat: 'Low Usage'
};

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

export let formatInsightShare = (share: number | null | undefined) =>
  share === null || share === undefined ? null : formatPercent(share, { precision: 0 });

export let flagCountOf = (summary: MemberInsights['summary'], flag: InsightFlag) =>
  summary.flagCounts[flagCountKeys[flag]];

export let describeFlagCount = (count: number | null, members: number) => {
  if (count === null) return null;
  if (count == 0) return 'Nobody flagged';

  return `${formatNumber(count)} of ${formatNumber(members)} ${members == 1 ? 'member' : 'members'} flagged`;
};

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

export let countsCappedNotice =
  'Some counts reached their limit of 10,000 and show the limit, not the real number.';

export let requestRecordsClippedNotice =
  'Practices and seats come from request records, which are kept for 90 days, so they cover only the most recent 90 days of this range.';

export let modelCatalogNotice =
  'Deprecated, retired and latest reflect the model catalog today, not when the requests were made.';

export let seatEstimateNotice =
  'Usage at list price is an estimate: what the requests in the range would cost at list prices, based on what Claude Code reports. Seat and plan are as Claude Code reports them. Use this to review seat assignments, not as a bill.';

export let noSeatReportedNotice =
  'No seat type has been reported yet: Claude Code reports the plan but not the seat. Members are judged by usage alone, and choosing seats flags nobody until seats are reported.';

export let hasNoReportedSeat = (summary: MemberInsights['summary']) =>
  !!summary.seat && summary.members > 0 && summary.seat.unknownSeatMembers >= summary.members;
