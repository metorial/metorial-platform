import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingSpendTimelineOutput = {
  object: 'agent_tracking.spend_timeline';
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
  interval: 'day';
  total: {
    cost: {
      currency: 'usd';
      total: string | null;
      billed: string | null;
      estimated: string | null;
      isEstimate: boolean;
      reportedByClient: string | null;
      listPrice: string | null;
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
  counts: { sessions: number; members: number; capped: boolean } | null;
  previous: {
    range: { preset: string | null; from: Date; to: Date; timeZone: string };
    total: {
      cost: {
        currency: 'usd';
        total: string | null;
        billed: string | null;
        estimated: string | null;
        isEstimate: boolean;
        reportedByClient: string | null;
        listPrice: string | null;
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
    hiddenGroups: boolean;
    startsBeforeRetention: boolean;
  };
  privacy: {
    hideIndividuals: boolean;
    minGroupUsers: number;
    hiddenGroups: boolean;
  };
  items: {
    date: string;
    startsAt: Date;
    hidden: boolean;
    cost:
      | ({
          currency: 'usd';
          total: string | null;
          billed: string | null;
          estimated: string | null;
          isEstimate: boolean;
          reportedByClient: string | null;
          listPrice: string | null;
        } & { requestsWithoutCost: number; requestsWithoutListPrice: number })
      | null;
    requests: number | null;
    tokens: {
      input: number;
      cacheRead: number;
      cacheWrite: number;
      output: number;
      reasoning: number;
      total: number;
    } | null;
    counts: { sessions: number; members: number } | null;
  }[];
};

export let mapDashboardInstanceAgentTrackingSpendTimelineOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSpendTimelineOutput>(
    [
      ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
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
                        'is_estimate',
                        'reported_by_client',
                        'list_price',
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
        'previous',
        0,
        [
          1,
          [
            ['range', 0, [1, [['from', 0, 4], ['to', 0, 4], 'time_zone']]],
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
                              'is_estimate',
                              'reported_by_client',
                              'list_price',
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
            'hidden_groups',
            'starts_before_retention'
          ]
        ]
      ],
      ['privacy', 0, [1, ['hide_individuals', 'min_group_users', 'hidden_groups']]],
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              'starts_at',
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
                          'is_estimate',
                          'reported_by_client',
                          'list_price',
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
    ],
    1
  );

export type DashboardInstanceAgentTrackingSpendTimelineQuery = {
  range?:
    'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month' | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  timeZone?: string | undefined;
  clientFamily?: string | string[] | undefined;
  modelId?: string | string[] | undefined;
};

export let mapDashboardInstanceAgentTrackingSpendTimelineQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSpendTimelineQuery>([
    ['from', 0, 4],
    ['to', 0, 4],
    'time_zone',
    'client_family',
    'model_id'
  ]);
