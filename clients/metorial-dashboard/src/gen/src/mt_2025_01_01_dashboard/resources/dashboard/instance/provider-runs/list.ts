import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderRunsListOutput = {
  items: {
    object: 'session.provider_run';
    id: string;
    status: 'running' | 'stopped';
    sessionId: string;
    sessionProviderId: string;
    providerId: string;
    connectionId: string;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderRunsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderRunsListOutput>(
    [
      7,
      [
        1,
        [
          'session_id',
          'session_provider_id',
          'provider_id',
          'connection_id',
          'completed_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceProviderRunsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'running' | 'stopped' | ('running' | 'stopped')[] | undefined;
  id?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  sessionProviderId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  providerVersionId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceProviderRunsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderRunsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'session_id',
            'provider_id',
            'session_provider_id',
            'session_connection_id',
            'provider_version_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
