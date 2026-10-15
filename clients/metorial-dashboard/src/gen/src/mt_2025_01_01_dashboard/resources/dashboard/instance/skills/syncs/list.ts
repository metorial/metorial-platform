import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsSyncsListOutput = {
  items: {
    object: 'skill.sync';
    id: string;
    status:
      | 'pending'
      | 'completed'
      | 'failed'
      | 'processing'
      | 'waiting_for_review'
      | 'canceled';
    skillMarketplaceId: string | null;
    skillPluginId: string | null;
    logs: { timestamp: Date; message: string }[];
    repositoryPropagations: {
      object: 'skill.sync_repository_propagation';
      id: string;
      status:
        | 'pending'
        | 'processing'
        | 'waiting_for_review'
        | 'completed'
        | 'failed'
        | 'canceled';
      repoId: string;
      repositoryAccessMode: 'pull_request' | 'default_branch';
      branchName: string;
      prName: string;
      prDescription: string | null;
      commitMessage: string | null;
      errorMessage: string | null;
      createdAt: Date;
      updatedAt: Date;
      startedAt: Date | null;
      completedAt: Date | null;
    }[];
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsSyncsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsSyncsListOutput>(
    [
      7,
      [
        1,
        [
          'skill_marketplace_id',
          'skill_plugin_id',
          ['logs', 0, [2, [1, [['timestamp', 0, 4]]]]],
          [
            'repository_propagations',
            1,
            [
              2,
              [
                1,
                [
                  'repo_id',
                  'repository_access_mode',
                  'branch_name',
                  'pr_name',
                  'pr_description',
                  'commit_message',
                  'error_message',
                  'created_at',
                  'updated_at',
                  'started_at',
                  'completed_at'
                ]
              ]
            ]
          ],
          'created_at',
          'started_at',
          'completed_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsSyncsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  skillMarketplaceId?: string | string[] | undefined;
  skillPluginId?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'completed'
    | 'failed'
    | 'processing'
    | 'waiting_for_review'
    | 'canceled'
    | (
        | 'pending'
        | 'completed'
        | 'failed'
        | 'processing'
        | 'waiting_for_review'
        | 'canceled'
      )[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSkillsSyncsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsSyncsListQuery>([
    3,
    [
      [
        0,
        [1, ['skill_marketplace_id', 'skill_plugin_id', ['created_at', 1, 5]]]
      ]
    ]
  ]);
