import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsKeyProvidersListOutput = {
  items: {
    object: 'key_provider';
    id: string;
    name: string;
    type: 'aws_kms' | 'local';
    owner: 'tenant' | 'system';
    status: 'active' | 'inactive' | 'degraded';
    isMetorialManaged: boolean;
    keyReuseTimeSeconds: number | null;
    keyInfo: Record<string, any>;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardProjectsKeyProvidersListOutput =
  /* @__PURE__ */ createMapper<DashboardProjectsKeyProvidersListOutput>(
    [
      7,
      [
        1,
        [
          'is_metorial_managed',
          'key_reuse_time_seconds',
          'key_info',
          'is_default',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardProjectsKeyProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardProjectsKeyProvidersListQuery =
  /* @__PURE__ */ createMapper<DashboardProjectsKeyProvidersListQuery>(0);
