import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ScmProvidersCreateOutput = {
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

export let mapScmProvidersCreateOutput =
  /* @__PURE__ */ mapObject<ScmProvidersCreateOutput>(
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

export type ScmProvidersCreateBody = {
  type: 'github_enterprise' | 'gitlab_selfhosted' | 'bitbucket_data_center';
};

export let mapScmProvidersCreateBody =
  /* @__PURE__ */ createMapper<ScmProvidersCreateBody>(0);
