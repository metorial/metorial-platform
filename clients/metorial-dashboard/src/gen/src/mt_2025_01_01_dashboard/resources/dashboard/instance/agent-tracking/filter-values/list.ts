import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingFilterValuesListOutput = {
  object: 'agent_tracking.filter_values';
  field: 'member' | 'model' | 'client' | 'seat';
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
  truncated: boolean;
  items: {
    value: string;
    kind: 'member' | 'model' | 'client' | 'seat' | 'unknown';
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
    model: { id: string; name: string | null } | null;
    client: { family: string; name: string | null } | null;
    requests: number | null;
  }[];
};

export let mapDashboardInstanceAgentTrackingFilterValuesListOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingFilterValuesListOutput>([
    ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
    ['items', 0, [2, [1, [['member', 0, [1, ['needs_review']]]]]]]
  ]);

export type DashboardInstanceAgentTrackingFilterValuesListQuery = {
  field: 'member' | 'model' | 'client' | 'seat';
  search?: string | undefined;
  value?: string | string[] | undefined;
  range?:
    'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month' | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  timeZone?: string | undefined;
};

export let mapDashboardInstanceAgentTrackingFilterValuesListQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingFilterValuesListQuery>([
    ['from', 0, 4],
    ['to', 0, 4],
    'time_zone'
  ]);
