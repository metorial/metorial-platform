import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingToolsProviderCallsOutput = {
  object: 'agent_tracking.provider_calls';
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
  groupBy: 'repository' | 'member' | 'client';
  providerId: string | null;
  toolKey: string | null;
  total: { calls: number; failed: number };
  items: {
    kind: 'repository' | 'member' | 'client' | 'unknown' | 'other';
    key: string;
    member: {
      object: 'agent_tracking.member';
      id: string;
      name: string | null;
      email: string | null;
      emails: string[];
      matched: boolean;
      consumer: { id: string | null; name: string; email: string } | null;
      needsReview: boolean;
    } | null;
    repository: {
      id: string;
      provider: string | null;
      host: string | null;
      owner: string | null;
      name: string | null;
      url: string | null;
    } | null;
    client: { family: string; name: string | null } | null;
    calls: number;
    failed: number;
  }[];
};

export let mapDashboardInstanceAgentTrackingToolsProviderCallsOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingToolsProviderCallsOutput>([
    ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
    'group_by',
    'provider_id',
    'tool_key',
    ['items', 0, [2, [1, [['member', 0, [1, ['needs_review']]]]]]]
  ]);

export type DashboardInstanceAgentTrackingToolsProviderCallsQuery = {
  groupBy: 'repository' | 'member' | 'client';
  providerId?: string | undefined;
  toolKey?: string | undefined;
  range?:
    'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month' | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  timeZone?: string | undefined;
};

export let mapDashboardInstanceAgentTrackingToolsProviderCallsQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingToolsProviderCallsQuery>([
    'group_by',
    'provider_id',
    'tool_key',
    ['from', 0, 4],
    ['to', 0, 4],
    'time_zone'
  ]);
