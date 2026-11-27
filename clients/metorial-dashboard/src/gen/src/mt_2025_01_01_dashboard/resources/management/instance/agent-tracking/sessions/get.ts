import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAgentTrackingSessionsGetOutput = {
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
  context: {
    repositories: {
      id: string;
      provider: string | null;
      host: string | null;
      owner: string | null;
      name: string | null;
      url: string | null;
    }[];
    branch: string | null;
    defaultBranch: string | null;
    head: string | null;
    worktree: boolean | null;
    subPath: string | null;
    permissionMode: string | null;
    title: string | null;
    tickets: { key: string; url: string | null }[];
    pullRequests: {
      key: string;
      provider: string;
      host: string | null;
      repository: string;
      number: number;
      kind: 'opened' | 'linked';
      url: string | null;
    }[];
    commitCount: number;
    pullRequestCount: number;
    lines: { added: number; removed: number };
  };
  providers: { id: string; name: string | null }[];
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
  commits: {
    sha: string;
    committedAt: Date;
    branch: string | null;
    tickets: { key: string; url: string | null }[];
    aiAuthored: boolean | null;
  }[];
};

export let mapManagementInstanceAgentTrackingSessionsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceAgentTrackingSessionsGetOutput>(
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
      [
        'context',
        0,
        [
          1,
          [
            'default_branch',
            'sub_path',
            'permission_mode',
            'pull_requests',
            'commit_count',
            'pull_request_count'
          ]
        ]
      ],
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
      ['commits', 0, [2, [1, ['committed_at', 'ai_authored']]]]
    ],
    1
  );
