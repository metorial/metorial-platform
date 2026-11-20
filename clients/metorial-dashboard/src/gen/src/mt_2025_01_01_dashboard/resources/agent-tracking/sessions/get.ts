import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AgentTrackingSessionsGetOutput = {
  object: 'agent_tracking.session_detail';
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
    total: string | null;
    billed: string | null;
    estimated: string | null;
    isEstimate: boolean;
    reportedByClient: string | null;
    listPrice: string | null;
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
  usageByModel: {
    kind: 'model' | 'unknown';
    key: string;
    model: { id: string; name: string | null } | null;
    unknownModelNames: string[];
    share: number | null;
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
  }[];
};

export let mapAgentTrackingSessionsGetOutput =
  /* @__PURE__ */ mapObject<AgentTrackingSessionsGetOutput>(
    [
      ['member', 0, [1, ['needs_review']]],
      'unknown_model_names',
      'billing_modes',
      ['cost', 0, [1, ['is_estimate', 'reported_by_client', 'list_price']]],
      ['tokens', 0, [1, ['cache_read', 'cache_write']]],
      'summary_pending',
      'started_at',
      'last_activity_at',
      'ended_at',
      [
        'usage_by_model',
        1,
        [
          2,
          [
            1,
            [
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
