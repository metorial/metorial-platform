import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceScmProvidersCreateOutput = {
  object: 'scm.provider.setup_session';
  id: string;
  type:
    | 'github'
    | 'github_enterprise'
    | 'gitlab'
    | 'gitlab_selfhosted'
    | 'bitbucket'
    | 'bitbucket_data_center';
  url: string;
  status: 'pending' | 'completed' | 'expired';
  provider: {
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
  } | null;
  createdAt: Date;
  expiresAt: Date;
};

export let mapManagementInstanceScmProvidersCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceScmProvidersCreateOutput>(
    [
      [
        'provider',
        0,
        [1, ['api_url', 'web_url', 'is_default', 'created_at', 'updated_at']]
      ],
      'created_at',
      'expires_at'
    ],
    1
  );

export type ManagementInstanceScmProvidersCreateBody = {
  type: 'github_enterprise' | 'gitlab_selfhosted' | 'bitbucket_data_center';
};

export let mapManagementInstanceScmProvidersCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceScmProvidersCreateBody>(0);
