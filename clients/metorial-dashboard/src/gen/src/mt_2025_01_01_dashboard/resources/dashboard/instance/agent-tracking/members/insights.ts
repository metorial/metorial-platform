import { createMapper, mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingMembersInsightsOutput = {
  object: 'agent_tracking.member_insights';
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
  include: ('models' | 'practices' | 'seat')[];
  truncated: boolean;
  items: {
    member: {
      object: 'agent_tracking.member';
      id: string;
      name: string | null;
      email: string | null;
      emails: string[];
      matched: boolean;
      consumer: { id: string | null; name: string; email: string } | null;
      needsReview: boolean;
    };
    rank: number;
    cost: {
      currency: 'usd';
      totalMicros: number | null;
      billedMicros: number | null;
      estimatedMicros: number | null;
      isEstimate: boolean;
      reportedByClientMicros: number | null;
      listPriceMicros: number | null;
    } & { requestsWithoutCost: number; requestsWithoutListPrice: number };
    share: number | null;
    sessions: number;
    requests: number;
    lastActivityAt: Date | null;
    models: {
      costMicros: number | null;
      requests: number;
      costShare: number | null;
      requestShare: number | null;
    } | null;
    practices: {
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
      outdatedModels: {
        model: { id: string; name: string | null };
        status: string | null;
        isLatest: boolean | null;
        costMicros: number | null;
      }[];
    } | null;
    seat: {
      seat: string | null;
      plan: string | null;
      listPriceMicros: number | null;
    } | null;
    flags: (
      | 'model_share'
      | 'high_effort'
      | 'fast_mode'
      | 'outdated_models'
      | 'low_cache_hit_rate'
      | 'low_usage_seat'
    )[];
  }[];
  pagination: {
    hasMoreAfter: boolean;
    hasMoreBefore: boolean;
    after?: string | undefined;
    before?: string | undefined;
  };
  summary: {
    cost: {
      currency: 'usd';
      totalMicros: number | null;
      billedMicros: number | null;
      estimatedMicros: number | null;
      isEstimate: boolean;
      reportedByClientMicros: number | null;
      listPriceMicros: number | null;
    } & { requestsWithoutCost: number; requestsWithoutListPrice: number };
    requests: number;
    sessions: number;
    activeMembers: number;
    countsCapped: boolean;
    unattributedCostMicros: number | null;
    members: number;
    flagCounts: {
      modelShare: number | null;
      highEffort: number | null;
      fastMode: number | null;
      outdatedModels: number | null;
      lowCacheHitRate: number | null;
      lowUsageSeat: number | null;
    };
    models: {
      costMicros: number | null;
      requests: number;
      costShare: number | null;
      requestShare: number | null;
    } | null;
    practices: {
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
    } | null;
    seat: { unknownSeatMembers: number } | null;
    requestRecordsClipped: boolean;
  };
};

export let mapDashboardInstanceAgentTrackingMembersInsightsOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingMembersInsightsOutput>(
    [
      ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              ['member', 0, [1, ['needs_review']]],
              [
                'cost',
                0,
                [
                  3,
                  [
                    [
                      0,
                      [
                        1,
                        [
                          'total_micros',
                          'billed_micros',
                          'estimated_micros',
                          'is_estimate',
                          'reported_by_client_micros',
                          'list_price_micros',
                          'requests_without_cost',
                          'requests_without_list_price'
                        ]
                      ]
                    ]
                  ]
                ]
              ],
              'last_activity_at',
              ['models', 0, [1, ['cost_micros', 'cost_share', 'request_share']]],
              [
                'practices',
                0,
                [
                  1,
                  [
                    'requests_measured',
                    'requests_with_effort',
                    'high_effort_requests',
                    'max_effort_requests',
                    'high_effort_share',
                    'fast_requests',
                    'fast_share',
                    'outdated_cost_micros',
                    'outdated_share',
                    'cache_hit_rate',
                    ['outdated_models', 1, [2, [1, ['is_latest', 'cost_micros']]]]
                  ]
                ]
              ],
              ['seat', 0, [1, ['list_price_micros']]]
            ]
          ]
        ]
      ],
      ['pagination', 0, 6],
      [
        'summary',
        0,
        [
          1,
          [
            [
              'cost',
              0,
              [
                3,
                [
                  [
                    0,
                    [
                      1,
                      [
                        'total_micros',
                        'billed_micros',
                        'estimated_micros',
                        'is_estimate',
                        'reported_by_client_micros',
                        'list_price_micros',
                        'requests_without_cost',
                        'requests_without_list_price'
                      ]
                    ]
                  ]
                ]
              ]
            ],
            'active_members',
            'counts_capped',
            'unattributed_cost_micros',
            [
              'flag_counts',
              1,
              [
                1,
                [
                  'model_share',
                  'high_effort',
                  'fast_mode',
                  'outdated_models',
                  'low_cache_hit_rate',
                  'low_usage_seat'
                ]
              ]
            ],
            ['models', 0, [1, ['cost_micros', 'cost_share', 'request_share']]],
            [
              'practices',
              0,
              [
                1,
                [
                  'requests_measured',
                  'requests_with_effort',
                  'high_effort_requests',
                  'max_effort_requests',
                  'high_effort_share',
                  'fast_requests',
                  'fast_share',
                  'outdated_cost_micros',
                  'outdated_share',
                  'cache_hit_rate'
                ]
              ]
            ],
            ['seat', 0, [1, ['unknown_seat_members']]],
            'request_records_clipped'
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceAgentTrackingMembersInsightsQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  range?:
    'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month' | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  timeZone?: string | undefined;
  include?: 'models' | 'practices' | 'seat' | ('models' | 'practices' | 'seat')[] | undefined;
  modelId?: string | string[] | undefined;
  seat?: string | string[] | undefined;
  sort?:
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
    | 'seat_usage'
    | undefined;
  includeInactive?: boolean | undefined;
  flaggedOnly?: boolean | undefined;
  modelShareMin?: number | undefined;
  highEffortShareMin?: number | undefined;
  fastShareMin?: number | undefined;
  outdatedShareMin?: number | undefined;
  cacheHitRateMax?: number | undefined;
  seatUsageMaxMicros?: number | undefined;
};

export let mapDashboardInstanceAgentTrackingMembersInsightsQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentTrackingMembersInsightsQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            ['from', 0, 4],
            ['to', 0, 4],
            'time_zone',
            'model_id',
            'include_inactive',
            'flagged_only',
            'model_share_min',
            'high_effort_share_min',
            'fast_share_min',
            'outdated_share_min',
            'cache_hit_rate_max',
            'seat_usage_max_micros'
          ]
        ]
      ]
    ]
  ]);
