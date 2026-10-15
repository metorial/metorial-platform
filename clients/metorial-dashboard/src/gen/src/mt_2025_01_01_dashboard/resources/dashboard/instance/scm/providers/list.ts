import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmProvidersListOutput = {
  items: {
    object: 'scm.provider';
    id: string;
    type:
      | 'github'
      | 'github_enterprise'
      | 'gitlab'
      | 'gitlab_selfhosted'
      | 'bitbucket'
      | 'bitbucket_data_center';
    name: string;
    description: string | null;
    apiUrl: string | null;
    webUrl: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceScmProvidersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceScmProvidersListOutput>(
    [7, [1, ['api_url', 'web_url', 'is_default', 'created_at', 'updated_at']]],
    1
  );

export type DashboardInstanceScmProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceScmProvidersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceScmProvidersListQuery>(0);
