import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmProvidersGetOutput = {
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
};

export let mapDashboardInstanceScmProvidersGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceScmProvidersGetOutput>(
    ['api_url', 'web_url', 'is_default', 'created_at', 'updated_at'],
    1
  );
