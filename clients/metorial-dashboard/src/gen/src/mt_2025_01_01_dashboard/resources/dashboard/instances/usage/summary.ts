import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancesUsageSummaryOutput = {
  object: 'instance.usage.summary';
  instanceId: string;
  from: Date;
  to: Date;
  kinds: (
    | 'tool_call'
    | 'message'
    | 'session'
    | 'connection'
    | 'connection_time'
    | 'session_error'
    | 'auth_event'
    | 'auth_error'
    | 'consumer'
  )[];
  groupBy:
    | 'kind'
    | 'provider'
    | 'deployment'
    | 'consumer'
    | 'magic_mcp_server'
    | 'integration'
    | 'tool'
    | 'error_type'
    | null;
  total: {
    count: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    durationMsSum: number;
    durationMsAvg: number | null;
    durationMsMax: number | null;
    activeConsumers: number;
    activeAgents: number;
  };
  byKind: {
    kind:
      | 'tool_call'
      | 'message'
      | 'session'
      | 'connection'
      | 'connection_time'
      | 'session_error'
      | 'auth_event'
      | 'auth_error'
      | 'consumer';
    count: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    durationMsSum: number;
    durationMsAvg: number | null;
    durationMsMax: number | null;
    activeConsumers: number;
    activeAgents: number;
  }[];
  top: {
    group: string | null;
    isOther: boolean;
    count: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    durationMsSum: number;
    durationMsAvg: number | null;
    durationMsMax: number | null;
    activeConsumers: number;
    activeAgents: number;
  }[];
};

export let mapDashboardInstancesUsageSummaryOutput =
  /* @__PURE__ */ mapObject<DashboardInstancesUsageSummaryOutput>([
    'instance_id',
    ['from', 0, 4],
    ['to', 0, 4],
    'group_by',
    [
      'total',
      0,
      [
        1,
        [
          'success_count',
          'error_count',
          'error_rate',
          'duration_ms_sum',
          'duration_ms_avg',
          'duration_ms_max',
          'active_consumers',
          'active_agents'
        ]
      ]
    ],
    [
      'by_kind',
      1,
      [
        2,
        [
          1,
          [
            'success_count',
            'error_count',
            'error_rate',
            'duration_ms_sum',
            'duration_ms_avg',
            'duration_ms_max',
            'active_consumers',
            'active_agents'
          ]
        ]
      ]
    ],
    [
      'top',
      0,
      [
        2,
        [
          1,
          [
            'is_other',
            'success_count',
            'error_count',
            'error_rate',
            'duration_ms_sum',
            'duration_ms_avg',
            'duration_ms_max',
            'active_consumers',
            'active_agents'
          ]
        ]
      ]
    ]
  ]);

export type DashboardInstancesUsageSummaryQuery = {
  kind:
    | 'tool_call'
    | 'message'
    | 'session'
    | 'connection'
    | 'connection_time'
    | 'session_error'
    | 'auth_event'
    | 'auth_error'
    | 'consumer'
    | (
        | 'tool_call'
        | 'message'
        | 'session'
        | 'connection'
        | 'connection_time'
        | 'session_error'
        | 'auth_event'
        | 'auth_error'
        | 'consumer'
      )[];
  from: Date;
  to: Date;
  providerId?: string | string[] | undefined;
  deploymentId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  magicMcpServerId?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  errorType?: string | string[] | undefined;
  groupBy?:
    | 'kind'
    | 'provider'
    | 'deployment'
    | 'consumer'
    | 'magic_mcp_server'
    | 'integration'
    | 'tool'
    | 'error_type'
    | undefined;
  maxSeries?: number | undefined;
};

export let mapDashboardInstancesUsageSummaryQuery =
  /* @__PURE__ */ mapObject<DashboardInstancesUsageSummaryQuery>([
    ['from', 0, 4],
    ['to', 0, 4],
    'provider_id',
    'deployment_id',
    'consumer_id',
    'magic_mcp_server_id',
    'integration_id',
    'error_type',
    'group_by',
    'max_series'
  ]);
