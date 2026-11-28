import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingToolsMcpServersOutput = {
  object: 'agent_tracking.mcp_server_usage';
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
  toolDetails: boolean;
  summary: {
    calls: number;
    failed: number;
    errorRate: number | null;
    members: number;
    lastUsedAt: Date | null;
    namedCalls: number;
    countsCapped: boolean;
  };
  items: {
    name: string;
    provider: { id: string; name: string | null } | null;
    calls: number;
    failed: number;
    errorRate: number | null;
    members: number;
    lastUsedAt: Date | null;
    tools: {
      name: string;
      calls: number;
      failed: number;
      errorRate: number | null;
      members: number;
      lastUsedAt: Date | null;
    }[];
  }[];
  truncated: boolean;
};

export let mapDashboardInstanceAgentTrackingToolsMcpServersOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingToolsMcpServersOutput>(
    [
      ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
      'tool_details',
      ['summary', 0, [1, ['error_rate', 'last_used_at', 'named_calls', 'counts_capped']]],
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              'error_rate',
              'last_used_at',
              ['tools', 0, [2, [1, ['error_rate', 'last_used_at']]]]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceAgentTrackingToolsMcpServersQuery = {
  range?:
    'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month' | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  timeZone?: string | undefined;
};

export let mapDashboardInstanceAgentTrackingToolsMcpServersQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingToolsMcpServersQuery>([
    ['from', 0, 4],
    ['to', 0, 4],
    'time_zone'
  ]);
