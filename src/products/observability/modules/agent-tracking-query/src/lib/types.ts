// Structural types only: importing this file must not pull in the services, the sync module or
// the RPC client.

export type RangePreset =
  'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month';

export type BreakdownGroup = 'member' | 'model';

export type SessionListOrderBy = 'last_activity' | 'cost';

export type FilterField = 'member' | 'model' | 'client';

export type AgentTrackingSpendFilters = {
  clientFamilies?: string[];
  modelIds?: string[];
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
  kind: 'member' | 'model' | 'unknown' | 'other';
  key: string;
  member: AgentTrackingMember | null;
  model: AgentTrackingModel | null;
  unknownModelNames: string[];
  share: number | null;
};

export type AgentTrackingSpendBreakdown = {
  range: AgentTrackingRange;
  groupBy: BreakdownGroup;
  total: AgentTrackingSpendFigures;
  items: AgentTrackingSpendBreakdownItem[];
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
};

export type AgentTrackingFilterValue = {
  value: string;
  kind: 'member' | 'model' | 'client' | 'unknown';
  member: AgentTrackingMember | null;
  model: AgentTrackingModel | null;
  client: Pick<AgentTrackingClient, 'family' | 'name'> | null;
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

export type AgentTrackingSetupStatus = {
  lastReceivedAt: Date | null;
  options: Record<SetupOptionKey, SetupOptionStatus>;
};
