import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAgentTrackingSessionsListOutput = {
  object: 'list';
  items: {
    object: 'agent_tracking.session';
    id: string;
    state: 'active' | 'idle' | 'ended';
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
    client: {
      family: string;
      name: string | null;
      surface: string | null;
      version: string | null;
    };
    models: { id: string; name: string | null }[];
    unknownModelNames: string[];
    billingModes: ('included' | 'overage' | 'api' | 'unknown')[];
    cost: {
      currency: 'usd';
      totalMicros: number | null;
      billedMicros: number | null;
      estimatedMicros: number | null;
      isEstimate: boolean;
      reportedByClientMicros: number | null;
      listPriceMicros: number | null;
    };
    tokens: {
      input: number;
      cacheRead: number;
      cacheWrite: number;
      output: number;
      reasoning: number;
      total: number;
    };
    requests: number;
    summaryPending: boolean;
    startedAt: Date;
    lastActivityAt: Date;
    endedAt: Date | null;
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapManagementInstanceAgentTrackingSessionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceAgentTrackingSessionsListOutput>(
    [
      7,
      [
        1,
        [
          ['member', 0, [1, ['needs_review']]],
          'unknown_model_names',
          'billing_modes',
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
          ['tokens', 0, [1, ['cache_read', 'cache_write']]],
          'summary_pending',
          'started_at',
          'last_activity_at',
          'ended_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceAgentTrackingSessionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  memberId?: string | string[] | undefined;
  modelId?: string | string[] | undefined;
  clientFamily?: string | string[] | undefined;
  orderBy?: 'last_activity' | 'cost' | undefined;
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

export let mapManagementInstanceAgentTrackingSessionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceAgentTrackingSessionsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'member_id',
              'model_id',
              'client_family',
              'order_by',
              ['from', 0, 4],
              ['to', 0, 4],
              'time_zone'
            ]
          ]
        ]
      ]
    ]
  );
