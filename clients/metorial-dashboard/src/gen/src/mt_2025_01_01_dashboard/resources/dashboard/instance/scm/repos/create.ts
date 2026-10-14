import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceScmReposCreateOutput = {
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

export let mapDashboardInstanceScmReposCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceScmReposCreateOutput>(
    ['is_private', 'default_branch', 'created_at'],
    1
  );

export type DashboardInstanceScmReposCreateBody = { installationId: string } & (
  | { externalRepoId: string }
  | { externalAccountId: string; name: string; isPrivate?: boolean | undefined }
);

export let mapDashboardInstanceScmReposCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceScmReposCreateBody>([
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
