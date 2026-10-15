import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsSyncsGetOutput = {
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
};

export let mapDashboardInstanceSkillsSyncsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsSyncsGetOutput>(
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
    ],
    1
  );
