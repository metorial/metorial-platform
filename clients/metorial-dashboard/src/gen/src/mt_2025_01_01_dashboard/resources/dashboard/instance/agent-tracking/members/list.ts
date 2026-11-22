import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingMembersListOutput = {
  object: 'list';
  items: {
    object: 'agent_tracking.member';
    id: string;
    name: string | null;
    email: string | null;
    emails: string[];
    matched: boolean;
    consumer: { id: string | null; name: string; email: string } | null;
    needsReview: boolean;
    lastSeenAt: Date;
    sessions: number;
    cost: {
      currency: 'usd';
      totalMicros: number | null;
      billedMicros: number | null;
      estimatedMicros: number | null;
      isEstimate: boolean;
      reportedByClientMicros: number | null;
      listPriceMicros: number | null;
    };
    listTruncated: boolean;
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapDashboardInstanceAgentTrackingMembersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentTrackingMembersListOutput>(
    [
      7,
      [
        1,
        [
          'needs_review',
          'last_seen_at',
          [
            'cost',
            0,
            [
              1,
              [
                'total_micros',
                'billed_micros',
                'estimated_micros',
                'is_estimate',
                'reported_by_client_micros',
                'list_price_micros'
              ]
            ]
          ],
          'list_truncated'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceAgentTrackingMembersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  memberId?: string | string[] | undefined;
  range?:
    | 'today'
    | 'last_7_days'
    | 'last_30_days'
    | 'month_to_date'
    | 'last_month'
    | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  timeZone?: string | undefined;
};

export let mapDashboardInstanceAgentTrackingMembersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentTrackingMembersListQuery>([
    3,
    [[0, [1, ['member_id', ['from', 0, 4], ['to', 0, 4], 'time_zone']]]]
  ]);
