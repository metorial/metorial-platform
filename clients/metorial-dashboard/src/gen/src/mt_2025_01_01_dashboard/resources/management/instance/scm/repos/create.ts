import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceScmReposCreateOutput = {
  object: 'scm.repository';
  id: string;
  provider: {
    object: 'scm.provider';
    type: 'github' | 'gitlab' | 'bitbucket';
    id: string;
    name: string;
    owner: string;
  };
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: Date;
};

export let mapManagementInstanceScmReposCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceScmReposCreateOutput>(
    ['is_private', 'default_branch', 'created_at'],
    1
  );

export type ManagementInstanceScmReposCreateBody = {
  installationId: string;
} & (
  | { externalRepoId: string }
  | { externalAccountId: string; name: string; isPrivate?: boolean | undefined }
);

export let mapManagementInstanceScmReposCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceScmReposCreateBody>([
    3,
    [
      [
        0,
        [
          1,
          [
            'installation_id',
            'external_repo_id',
            'external_account_id',
            'is_private'
          ]
        ]
      ]
    ]
  ]);
