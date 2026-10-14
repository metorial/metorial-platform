import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsMarketplacesRepositoriesCreateOutput = {
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

export let mapSkillsMarketplacesRepositoriesCreateOutput =
  /* @__PURE__ */ mapObject<SkillsMarketplacesRepositoriesCreateOutput>(
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

export type SkillsMarketplacesRepositoriesCreateBody = { repoId: string };

export let mapSkillsMarketplacesRepositoriesCreateBody =
  /* @__PURE__ */ mapObject<SkillsMarketplacesRepositoriesCreateBody>([
    'repo_id'
  ]);
