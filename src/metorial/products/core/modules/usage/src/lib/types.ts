export let usageMetricKinds = [
  'tool_call',
  'message',
  'session',
  'connection',
  'connection_time',
  'session_error',
  'auth_event',
  'auth_error',
  'consumer'
] as const;

export type UsageMetricKind = (typeof usageMetricKinds)[number];

export let usageDimensionKeys = [
  'providerId',
  'deploymentId',
  'consumerId',
  'consumerProfileId',
  'agentId',
  'magicMcpServerId',
  'integrationId',
  'toolKey',
  'errorType'
] as const;

export type UsageDimensionKey = (typeof usageDimensionKeys)[number];

export type UsageDimensions = Partial<Record<UsageDimensionKey, string | null>>;

export type UsageEvent = {
  instanceId: string;
  organizationId?: string | null;
  kind: UsageMetricKind;
  dims?: UsageDimensions;
  isError?: boolean;
  durationMs?: number | null;
  ts?: Date;
};

export type UsageCounters = {
  count: number;
  errorCount: number;
  durationMsSum: number;
  durationCount: number;
  durationMsMax: number;
};

export type UsageBucketKey = {
  instanceId: string;
  organizationId: string | null;
  kind: UsageMetricKind;
  dims: UsageDimensions;
};

export let usageGroupByDimensions = {
  provider: 'providerId',
  deployment: 'deploymentId',
  consumer: 'consumerId',
  magic_mcp_server: 'magicMcpServerId',
  integration: 'integrationId',
  tool: 'toolKey',
  error_type: 'errorType'
} as const satisfies Record<string, UsageDimensionKey>;

export type UsageGroupBy = keyof typeof usageGroupByDimensions | 'kind';

export let usageGroupByValues = [
  'kind',
  ...(Object.keys(usageGroupByDimensions) as (keyof typeof usageGroupByDimensions)[])
] as [UsageGroupBy, ...UsageGroupBy[]];

export let USAGE_OTHER_GROUP = '__other__';

export type UsageFilter = {
  instanceIds: string[];
  kinds: UsageMetricKind[];
  from: Date;
  to: Date;
  dims?: Partial<Record<UsageDimensionKey, string[] | undefined>>;
};
