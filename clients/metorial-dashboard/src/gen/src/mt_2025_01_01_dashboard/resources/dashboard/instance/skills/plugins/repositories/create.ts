import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsPluginsRepositoriesCreateOutput = {
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

export let mapDashboardInstanceSkillsPluginsRepositoriesCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsPluginsRepositoriesCreateOutput>(
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

export type DashboardInstanceSkillsPluginsRepositoriesCreateBody = {
  repoId: string;
};

export let mapDashboardInstanceSkillsPluginsRepositoriesCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsPluginsRepositoriesCreateBody>(
    ['repo_id']
  );
