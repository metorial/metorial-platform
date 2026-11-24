import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderTemplatesListOutput = {
  items: {
    object: 'provider.template';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    integrationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderTemplatesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderTemplatesListOutput>(
    [7, [1, ['integration_id', 'created_at', 'updated_at']]],
    1
  );

export type DashboardInstanceProviderTemplatesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
};

export let mapDashboardInstanceProviderTemplatesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderTemplatesListQuery>([
    3,
    [[0, [1, ['integration_id']]]]
  ]);
