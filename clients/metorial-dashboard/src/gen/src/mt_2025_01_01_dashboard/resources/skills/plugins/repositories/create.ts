import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsPluginsRepositoriesCreateOutput = {
  object: 'skill.plugin_repository';
  id: string;
  skillPluginId: string;
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

export let mapSkillsPluginsRepositoriesCreateOutput =
  /* @__PURE__ */ mapObject<SkillsPluginsRepositoriesCreateOutput>(
    [
      'skill_plugin_id',
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

export type SkillsPluginsRepositoriesCreateBody = { repoId: string };

export let mapSkillsPluginsRepositoriesCreateBody =
  /* @__PURE__ */ mapObject<SkillsPluginsRepositoriesCreateBody>(['repo_id']);
