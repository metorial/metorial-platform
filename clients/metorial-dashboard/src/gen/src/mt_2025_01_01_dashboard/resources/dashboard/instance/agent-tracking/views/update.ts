import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingViewsUpdateOutput = {
  object: 'agent_tracking.view';
  id: string;
  name: string;
  page: 'team';
  kind: 'recent' | 'leaderboard' | 'by_model' | 'practices' | 'seats';
  params: {
    version: '1';
    range?:
      'today' | 'last_7_days' | 'last_30_days' | 'month_to_date' | 'last_month' | undefined;
    order?: 'asc' | 'desc' | undefined;
    modelIds?: string[] | undefined;
    seats?: string[] | undefined;
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
  createdBy: {
    object: 'organization.actor';
    id: string;
    type: 'member' | 'machine_access';
    organizationId: string;
    name: string;
    email: string | null;
    imageUrl: string;
    member: {
      object: 'organization.member#preview';
      id: string;
      status: 'active' | 'deleted';
      role: 'member' | 'admin';
    } | null;
    teams: {
      id: string;
      name: string;
      slug: string;
      assignmentId: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export let mapDashboardInstanceAgentTrackingViewsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingViewsUpdateOutput>(
    [
      [
        'params',
        0,
        [
          1,
          [
            'model_ids',
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
      ],
      [
        'created_by',
        1,
        [
          1,
          [
            'organization_id',
            'image_url',
            ['teams', 0, [2, [1, ['assignment_id', 'created_at', 'updated_at']]]],
            'created_at',
            'updated_at'
          ]
        ]
      ],
      'created_at',
      'updated_at',
      'deleted_at'
    ],
    1
  );

export type DashboardInstanceAgentTrackingViewsUpdateBody = {
  name?: string | undefined;
  kind?: 'recent' | 'leaderboard' | 'by_model' | 'practices' | 'seats' | undefined;
  params?:
    | {
        version: '1';
        range?:
          | 'today'
          | 'last_7_days'
          | 'last_30_days'
          | 'month_to_date'
          | 'last_month'
          | undefined;
        order?: 'asc' | 'desc' | undefined;
        modelIds?: string[] | undefined;
        seats?: string[] | undefined;
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
      }
    | undefined;
};

export let mapDashboardInstanceAgentTrackingViewsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingViewsUpdateBody>([
    [
      'params',
      0,
      [
        1,
        [
          'model_ids',
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
  ]);
