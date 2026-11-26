// Structural types only: importing this file must not pull in the services, the sync module or
// the RPC client.

export type RangePreset =
  'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month';

export type BreakdownGroup = 'member' | 'model' | 'repository' | 'branch' | 'ticket';

export type SpendReportGroup = 'member' | 'model' | 'client';

export type SpendGroup = BreakdownGroup | SpendReportGroup;

export type SessionListOrderBy = 'last_activity' | 'cost';

export type FilterField =
  'member' | 'model' | 'client' | 'seat' | 'repository' | 'branch' | 'ticket';

export type AgentTrackingSpendFilters = {
  clientFamilies?: string[];
  modelIds?: string[];
  memberIds?: string[];
};

export type MemberInsightsGroup = 'models' | 'practices' | 'seat';

export type MemberInsightsSort =
  | 'cost'
  | 'sessions'
  | 'requests'
  | 'last_activity'
  | 'model_share'
  | 'model_cost'
  | 'high_effort_share'
  | 'fast_share'
  | 'outdated_share'
  | 'cache_hit_rate'
  | 'seat_usage';

export type MemberInsightsFlag =
  | 'model_share'
  | 'high_effort'
  | 'fast_mode'
  | 'outdated_models'
  | 'low_cache_hit_rate'
  | 'low_usage_seat';

export type MemberInsightsThresholds = {
  modelShareMin?: number;
  highEffortShareMin?: number;
  fastShareMin?: number;
  outdatedShareMin?: number;
  cacheHitRateMax?: number;
  seatUsageMaxMicros?: number;
};

export type SetupOptionKey =
  'usageAndCost' | 'keepLocalHistory' | 'repository' | 'toolDetails' | 'hooks';

export type SetupOptionStatus = 'detected' | 'not_detected' | 'undetectable';

export type AgentTrackingCost = {
  totalMicros: number | null;
  billedMicros: number | null;
  estimatedMicros: number | null;
  isEstimate: boolean;
  reportedByClientMicros: number | null;
  listPriceMicros: number | null;
};

export type AgentTrackingSpendCost = AgentTrackingCost & {
  requestsWithoutCost: number;
  requestsWithoutListPrice: number;
};

export type AgentTrackingTokens = {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  reasoning: number;
  total: number;
};

export type AgentTrackingRange = {
  preset: RangePreset | null;
  from: Date;
  to: Date;
  timeZone: string;
};

export type AgentTrackingMember = {
  id: string;
  name: string | null;
  email: string | null;
  emails: string[];
  matched: boolean;
  consumer: { id: string | null; name: string; email: string } | null;
  needsReview: boolean;
};

export type AgentTrackingModel = { id: string; name: string | null };

export type AgentTrackingRepository = {
  id: string;
  provider: string | null;
  host: string | null;
  owner: string | null;
  name: string | null;
  url: string | null;
};

export type AgentTrackingTicket = { key: string; url: string | null };

export type AgentTrackingPullRequest = {
  key: string;
  provider: string;
  host: string | null;
  repository: string;
  number: number;
  kind: 'opened' | 'linked';
  url: string | null;
};

export type AgentTrackingCommit = {
  sha: string;
  committedAt: Date;
  branch: string | null;
  tickets: AgentTrackingTicket[];
  aiAuthored: boolean | null;
};

export type AgentTrackingSessionContext = {
  repositories: AgentTrackingRepository[];
  branch: string | null;
  defaultBranch: string | null;
  head: string | null;
  worktree: boolean | null;
  subPath: string | null;
  permissionMode: string | null;
  title: string | null;
  tickets: AgentTrackingTicket[];
  pullRequests: AgentTrackingPullRequest[];
  commitCount: number;
  pullRequestCount: number;
  lines: { added: number; removed: number };
};

export type AgentTrackingSpendFigures = {
  cost: AgentTrackingSpendCost;
  requests: number;
  tokens: AgentTrackingTokens;
};

export type AgentTrackingSpendCounts = {
  sessions: number;
  members: number;
  capped: boolean;
};

export type AgentTrackingDayCounts = {
  sessions: number;
  members: number;
};

export type AgentTrackingReadPrivacy = {
  hideIndividuals: boolean;
  minGroupUsers: number;
  hiddenGroups: boolean;
};

export type AgentTrackingPreviousPeriod = {
  range: AgentTrackingRange;
  total: AgentTrackingSpendFigures;
  startsBeforeRetention: boolean;
  hiddenGroups: boolean;
};

export type AgentTrackingSpendDay = {
  date: string;
  startsAt: Date;
  hidden: boolean;
  cost: AgentTrackingSpendCost | null;
  requests: number | null;
  tokens: AgentTrackingTokens | null;
  counts: AgentTrackingDayCounts | null;
};

export type AgentTrackingSpendTimeline = {
  range: AgentTrackingRange;
  interval: 'day';
  total: AgentTrackingSpendFigures;
  counts: AgentTrackingSpendCounts | null;
  previous: AgentTrackingPreviousPeriod;
  privacy: AgentTrackingReadPrivacy;
  items: AgentTrackingSpendDay[];
};

export type AgentTrackingSpendBreakdownItem = AgentTrackingSpendFigures & {
  kind: SpendGroup | 'unknown' | 'other';
  key: string;
  member: AgentTrackingMember | null;
  model: AgentTrackingModel | null;
  client: Pick<AgentTrackingClient, 'family' | 'name'> | null;
  repository: AgentTrackingRepository | null;
  ticket: AgentTrackingTicket | null;
  unknownModelNames: string[];
  share: number | null;
};

export type AgentTrackingSpendBreakdown = {
  range: AgentTrackingRange;
  groupBy: BreakdownGroup;
  total: AgentTrackingSpendFigures;
  items: AgentTrackingSpendBreakdownItem[];
};

export type AgentTrackingSpendReportMonth = AgentTrackingSpendFigures & {
  month: string;
  startsAt: Date;
  hiddenDays: number;
  counts: AgentTrackingDayCounts | null;
};

export type AgentTrackingSpendCoverage = {
  firstDay: string | null;
  daysWithData: number;
  hiddenDays: number;
  startsBeforeYear: boolean;
  lastFullDay: string | null;
};

export type ProjectionStatus = 'projected' | 'insufficient_data' | 'not_applicable';

export type GrowthRateSource = 'input' | 'observed' | 'default';

export type AgentTrackingProjectedMonth = {
  month: string;
  actualMicros: number;
  projectedMicros: number;
  totalMicros: number;
};

export type AgentTrackingProjectionScenario = {
  growthRate: number;
  months: AgentTrackingProjectedMonth[];
  yearEndTotalMicros: number;
  nextYearTotalMicros: number;
};

export type AgentTrackingSpendProjection = {
  status: ProjectionStatus;
  baseline: {
    from: string;
    to: string;
    days: number;
    dailyRateMicros: number | null;
  } | null;
  growth: { rate: number; source: GrowthRateSource } | null;
  scenarios: {
    flat: AgentTrackingProjectionScenario;
    growth: AgentTrackingProjectionScenario;
  } | null;
};

export type AgentTrackingSpendReport = {
  year: number;
  range: AgentTrackingRange;
  total: AgentTrackingSpendFigures;
  counts: AgentTrackingSpendCounts | null;
  startsBeforeRetention: boolean;
  privacy: AgentTrackingReadPrivacy;
  months: AgentTrackingSpendReportMonth[];
  coverage: AgentTrackingSpendCoverage;
  breakdowns: Record<SpendReportGroup, AgentTrackingSpendBreakdownItem[] | null>;
  projection: AgentTrackingSpendProjection;
};

export type AgentTrackingClient = {
  family: string;
  name: string | null;
  surface: string | null;
  version: string | null;
};

export type AgentTrackingSessionView = {
  id: string;
  state: 'active' | 'idle' | 'ended';
  member: AgentTrackingMember | null;
  client: AgentTrackingClient;
  models: AgentTrackingModel[];
  unknownModelNames: string[];
  billingModes: string[];
  cost: AgentTrackingCost;
  tokens: AgentTrackingTokens;
  requests: number;
  summaryPending: boolean;
  context: AgentTrackingSessionContext;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt: Date | null;
};

export type AgentTrackingSessionModelUsage = AgentTrackingSpendFigures & {
  kind: 'model' | 'unknown';
  key: string;
  model: AgentTrackingModel | null;
  unknownModelNames: string[];
  share: number | null;
};

export type AgentTrackingSessionDetail = AgentTrackingSessionView & {
  usageByModel: AgentTrackingSessionModelUsage[];
  commits: AgentTrackingCommit[];
};

export type AgentTrackingFilterValue = {
  value: string;
  kind: FilterField | 'unknown';
  member: AgentTrackingMember | null;
  model: AgentTrackingModel | null;
  client: Pick<AgentTrackingClient, 'family' | 'name'> | null;
  repository: AgentTrackingRepository | null;
  requests: number | null;
};

export type AgentTrackingFilterValues = {
  field: FilterField;
  range: AgentTrackingRange;
  items: AgentTrackingFilterValue[];
  truncated: boolean;
};

export type AgentTrackingSeenMember = AgentTrackingMember & {
  lastSeenAt: Date;
  sessions: number;
  cost: AgentTrackingCost;
};

export type AgentTrackingMemberList = {
  list: {
    items: AgentTrackingSeenMember[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      after?: string;
      before?: string;
    };
  };
  truncated: boolean;
};

export type AgentTrackingModelUsageFigures = {
  costMicros: number | null;
  requests: number;
  costShare: number | null;
  requestShare: number | null;
};

export type AgentTrackingPracticeFigures = {
  requestsMeasured: number;
  requestsWithEffort: number;
  highEffortRequests: number;
  maxEffortRequests: number;
  highEffortShare: number | null;
  fastRequests: number;
  fastShare: number | null;
  outdatedCostMicros: number | null;
  outdatedShare: number | null;
  cacheHitRate: number | null;
};

export type AgentTrackingOutdatedModel = {
  model: AgentTrackingModel;
  status: string | null;
  isLatest: boolean | null;
  costMicros: number | null;
};

export type AgentTrackingMemberPractices = AgentTrackingPracticeFigures & {
  outdatedModels: AgentTrackingOutdatedModel[];
};

export type AgentTrackingMemberSeat = {
  seat: string | null;
  plan: string | null;
  listPriceMicros: number | null;
};

export type AgentTrackingMemberInsightFigures = {
  id: string;
  rank: number;
  cost: AgentTrackingSpendCost;
  share: number | null;
  sessions: number;
  requests: number;
  lastActivityAt: Date | null;
  models: AgentTrackingModelUsageFigures | null;
  practices: AgentTrackingMemberPractices | null;
  seat: AgentTrackingMemberSeat | null;
  flags: MemberInsightsFlag[];
};

export type AgentTrackingMemberInsight = AgentTrackingMemberInsightFigures & {
  member: AgentTrackingMember;
};

export type AgentTrackingMemberInsightsSummary = {
  cost: AgentTrackingSpendCost;
  requests: number;
  sessions: number;
  activeMembers: number;
  countsCapped: boolean;
  unattributedCostMicros: number | null;
  members: number;
  flagCounts: Record<MemberInsightsFlag, number | null>;
  models: AgentTrackingModelUsageFigures | null;
  practices: AgentTrackingPracticeFigures | null;
  seat: { unknownSeatMembers: number } | null;
  requestRecordsClipped: boolean;
};

export type AgentTrackingMemberInsights = {
  range: AgentTrackingRange;
  include: MemberInsightsGroup[];
  list: {
    items: AgentTrackingMemberInsight[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      after?: string;
      before?: string;
    };
  };
  truncated: boolean;
  summary: AgentTrackingMemberInsightsSummary;
};

export type AgentTrackingSetupStatus = {
  lastReceivedAt: Date | null;
  options: Record<SetupOptionKey, SetupOptionStatus>;
};

export type AgentTrackingToolCallFigures = {
  calls: number;
  failed: number;
  errorRate: number | null;
  members: number;
  lastUsedAt: Date | null;
};

export type AgentTrackingMcpToolUsage = AgentTrackingToolCallFigures & { name: string };

export type AgentTrackingMcpServerUsageItem = AgentTrackingToolCallFigures & {
  name: string;
  tools: AgentTrackingMcpToolUsage[];
};

export type AgentTrackingMcpServerUsage = {
  range: AgentTrackingRange;
  toolDetails: boolean;
  summary: AgentTrackingToolCallFigures & {
    namedCalls: number;
    countsCapped: boolean;
  };
  items: AgentTrackingMcpServerUsageItem[];
  truncated: boolean;
};

export type AgentTrackingSkillUsageItem = {
  name: string;
  activations: number;
  members: number;
  lastUsedAt: Date | null;
};

export type AgentTrackingSkillUsage = {
  range: AgentTrackingRange;
  toolDetails: boolean;
  summary: {
    activations: number;
    namedActivations: number;
    members: number;
    countsCapped: boolean;
  };
  items: AgentTrackingSkillUsageItem[];
  truncated: boolean;
};
