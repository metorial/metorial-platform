import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsMarketplacesRepositoriesCreateOutput = {
  object: 'skill.marketplace_repository';
  id: string;
  skillMarketplaceId: string;
  repoId: string;
  repository: {
    object: 'scm.repository#skill';
    id: string;
    provider: 'github' | 'gitlab' | 'bitbucket';
    name: string;
    url: string;
    isPrivate: boolean;
    defaultBranch: string;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSkillsMarketplacesRepositoriesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsMarketplacesRepositoriesCreateOutput>(
    [
      'skill_marketplace_id',
      'repo_id',
      [
        'repository',
        0,
        [1, ['is_private', 'default_branch', 'created_at', 'updated_at']]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceSkillsMarketplacesRepositoriesCreateBody = {
  repoId: string;
};

export let mapManagementInstanceSkillsMarketplacesRepositoriesCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsMarketplacesRepositoriesCreateBody>(
    ['repo_id']
  );
