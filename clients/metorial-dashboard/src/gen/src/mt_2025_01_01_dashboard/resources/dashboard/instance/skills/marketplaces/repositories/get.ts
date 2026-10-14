import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsMarketplacesRepositoriesGetOutput = {
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

export let mapDashboardInstanceSkillsMarketplacesRepositoriesGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsMarketplacesRepositoriesGetOutput>(
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
