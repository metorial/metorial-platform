import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingSpendBreakdownOutput = {
  object: 'agent_tracking.spend_breakdown';
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
  groupBy: 'member' | 'model';
  total: {
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
    tokens: {
      input: number;
      cacheRead: number;
      cacheWrite: number;
      output: number;
      reasoning: number;
      total: number;
    };
  };
  items: {
    kind: 'member' | 'model' | 'unknown' | 'other';
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
    model: { id: string; name: string | null } | null;
    unknownModelNames: string[];
    share: number | null;
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
    tokens: {
      input: number;
      cacheRead: number;
      cacheWrite: number;
      output: number;
      reasoning: number;
      total: number;
    };
  }[];
};

export let mapDashboardInstanceAgentTrackingSpendBreakdownOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSpendBreakdownOutput>(
    [
      ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
      'group_by',
      [
        'total',
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
            ['tokens', 0, [1, ['cache_read', 'cache_write']]]
          ]
        ]
      ],
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              ['member', 0, [1, ['needs_review']]],
              'unknown_model_names',
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
              ['tokens', 0, [1, ['cache_read', 'cache_write']]]
            ]
          ]
        ]
      ]
    ]
  );

export type DashboardInstanceAgentTrackingSpendBreakdownQuery = {
  groupBy: 'member' | 'model';
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
  clientFamily?: string | string[] | undefined;
  modelId?: string | string[] | undefined;
};

export let mapDashboardInstanceAgentTrackingSpendBreakdownQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSpendBreakdownQuery>([
    'group_by',
    ['from', 0, 4],
    ['to', 0, 4],
    'time_zone',
    'client_family',
    'model_id'
  ]);
