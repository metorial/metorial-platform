import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsPluginsRepositoriesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsPluginsRepositoriesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsPluginsRepositoriesListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSkillsPluginsRepositoriesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceSkillsPluginsRepositoriesListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsPluginsRepositoriesListQuery>(
    0
  );
