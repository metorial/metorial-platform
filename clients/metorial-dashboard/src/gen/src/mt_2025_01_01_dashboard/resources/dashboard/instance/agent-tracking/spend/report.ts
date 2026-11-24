import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingSpendReportOutput = {
  object: 'agent_tracking.spend_report';
  year: number;
  range: { preset: string | null; from: Date; to: Date; timeZone: string };
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
  counts: { sessions: number; members: number; capped: boolean } | null;
  startsBeforeRetention: boolean;
  privacy: {
    hideIndividuals: boolean;
    minGroupUsers: number;
    hiddenGroups: boolean;
  };
  coverage: {
    firstDay: string | null;
    daysWithData: number;
    hiddenDays: number;
    startsBeforeYear: boolean;
    lastFullDay: string | null;
  };
  months: {
    month: string;
    startsAt: Date;
    hiddenDays: number;
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
    counts: { sessions: number; members: number } | null;
  }[];
  breakdowns: {
    model:
      | {
          kind: 'member' | 'model' | 'client' | 'unknown' | 'other';
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
          client: { family: string; name: string | null } | null;
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
        }[]
      | null;
    client:
      | {
          kind: 'member' | 'model' | 'client' | 'unknown' | 'other';
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
          client: { family: string; name: string | null } | null;
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
        }[]
      | null;
    member:
      | {
          kind: 'member' | 'model' | 'client' | 'unknown' | 'other';
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
          client: { family: string; name: string | null } | null;
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
        }[]
      | null;
  };
  projection: {
    status: 'projected' | 'insufficient_data' | 'not_applicable';
    baseline: {
      from: string;
      to: string;
      days: number;
      dailyRateMicros: number | null;
    } | null;
    growth: { rate: number; source: 'input' | 'observed' | 'default' } | null;
    scenarios: {
      flat: {
        growthRate: number;
        yearEndTotalMicros: number;
        nextYearTotalMicros: number;
        months: {
          month: string;
          actualMicros: number;
          projectedMicros: number;
          totalMicros: number;
        }[];
      };
      growth: {
        growthRate: number;
        yearEndTotalMicros: number;
        nextYearTotalMicros: number;
        months: {
          month: string;
          actualMicros: number;
          projectedMicros: number;
          totalMicros: number;
        }[];
      };
    } | null;
  };
};

export let mapDashboardInstanceAgentTrackingSpendReportOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSpendReportOutput>(
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
      'starts_before_retention',
      ['privacy', 0, [1, ['hide_individuals', 'min_group_users', 'hidden_groups']]],
      [
        'coverage',
        0,
        [
          1,
          ['first_day', 'days_with_data', 'hidden_days', 'starts_before_year', 'last_full_day']
        ]
      ],
      [
        'months',
        0,
        [
          2,
          [
            1,
            [
              'starts_at',
              'hidden_days',
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
      ],
      [
        'breakdowns',
        0,
        [
          1,
          [
            [
              'model',
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
            ],
            [
              'client',
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
            ],
            [
              'member',
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
        ]
      ],
      [
        'projection',
        0,
        [
          1,
          [
            ['baseline', 0, [1, ['daily_rate_micros']]],
            [
              'scenarios',
              0,
              [
                1,
                [
                  [
                    'flat',
                    0,
                    [
                      1,
                      [
                        'growth_rate',
                        'year_end_total_micros',
                        'next_year_total_micros',
                        [
                          'months',
                          0,
                          [2, [1, ['actual_micros', 'projected_micros', 'total_micros']]]
                        ]
                      ]
                    ]
                  ],
                  [
                    'growth',
                    0,
                    [
                      1,
                      [
                        'growth_rate',
                        'year_end_total_micros',
                        'next_year_total_micros',
                        [
                          'months',
                          0,
                          [2, [1, ['actual_micros', 'projected_micros', 'total_micros']]]
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceAgentTrackingSpendReportQuery = {
  year?: number | undefined;
  growthRate?: number | undefined;
  timeZone?: string | undefined;
};

export let mapDashboardInstanceAgentTrackingSpendReportQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSpendReportQuery>([
    'growth_rate',
    'time_zone'
  ]);
