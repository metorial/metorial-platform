import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancesUsageTimelineOutput = {
  object: 'instance.usage.timeline';
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
  interval: '1m' | '5m' | '15m' | '1h' | '6h' | '12h' | '1d';
  total: {
    timestamp: Date;
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
  series: {
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
      | null;
    group: string | null;
    isOther: boolean;
    points: {
      timestamp: Date;
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
  }[];
};

export let mapDashboardInstancesUsageTimelineOutput =
  /* @__PURE__ */ mapObject<DashboardInstancesUsageTimelineOutput>([
    'instance_id',
    ['from', 0, 4],
    ['to', 0, 4],
    'group_by',
    [
      'total',
      0,
      [
        2,
        [
          1,
          [
            ['timestamp', 0, 4],
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
      'series',
      0,
      [
        2,
        [
          1,
          [
            'is_other',
            [
              'points',
              0,
              [
                2,
                [
                  1,
                  [
                    ['timestamp', 0, 4],
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
          ]
        ]
      ]
    ]
  ]);

export type DashboardInstancesUsageTimelineQuery = {
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
  consumerProfileId?: string | string[] | undefined;
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
  interval?: '1m' | '5m' | '15m' | '1h' | '6h' | '12h' | '1d' | undefined;
};

export let mapDashboardInstancesUsageTimelineQuery =
  /* @__PURE__ */ mapObject<DashboardInstancesUsageTimelineQuery>([
    ['from', 0, 4],
    ['to', 0, 4],
    'provider_id',
    'deployment_id',
    'consumer_id',
    'consumer_profile_id',
    'magic_mcp_server_id',
    'integration_id',
    'error_type',
    'group_by',
    'max_series'
  ]);
