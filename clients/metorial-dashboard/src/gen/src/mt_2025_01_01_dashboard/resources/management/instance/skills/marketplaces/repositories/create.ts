import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsMarketplacesRepositoriesCreateOutput = {
  object: 'skill.marketplace_repository';
  id: string;
  skillMarketplaceId: string;
  repoId: string;
  repository: {
    object: 'scm.repository#skill';
    id: string;
    provider: 'github' | 'gitlab';
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
  mtMap.object<ManagementInstanceSkillsMarketplacesRepositoriesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    skillMarketplaceId: mtMap.objectField(
      'skill_marketplace_id',
      mtMap.passthrough()
    ),
    repoId: mtMap.objectField('repo_id', mtMap.passthrough()),
    repository: mtMap.objectField(
      'repository',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        provider: mtMap.objectField('provider', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        url: mtMap.objectField('url', mtMap.passthrough()),
        isPrivate: mtMap.objectField('is_private', mtMap.passthrough()),
        defaultBranch: mtMap.objectField('default_branch', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceSkillsMarketplacesRepositoriesCreateBody = {
  repoId: string;
};

export let mapManagementInstanceSkillsMarketplacesRepositoriesCreateBody =
  mtMap.object<ManagementInstanceSkillsMarketplacesRepositoriesCreateBody>({
    repoId: mtMap.objectField('repo_id', mtMap.passthrough())
  });

