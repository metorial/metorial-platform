import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SkillsMarketplacesRepositoriesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsMarketplacesRepositoriesListOutput =
  /* @__PURE__ */ createMapper<SkillsMarketplacesRepositoriesListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type SkillsMarketplacesRepositoriesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSkillsMarketplacesRepositoriesListQuery =
  /* @__PURE__ */ createMapper<SkillsMarketplacesRepositoriesListQuery>(0);
