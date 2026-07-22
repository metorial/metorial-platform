import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardInstanceSkillsSyncsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    skillMarketplaceId: mtMap.objectField(
      'skill_marketplace_id',
      mtMap.passthrough()
    ),
    skillPluginId: mtMap.objectField('skill_plugin_id', mtMap.passthrough()),
    logs: mtMap.objectField(
      'logs',
      mtMap.array(
        mtMap.object({
          timestamp: mtMap.objectField('timestamp', mtMap.date()),
          message: mtMap.objectField('message', mtMap.passthrough())
        })
      )
    ),
    repositoryPropagations: mtMap.objectField(
      'repository_propagations',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          repoId: mtMap.objectField('repo_id', mtMap.passthrough()),
          repositoryAccessMode: mtMap.objectField(
            'repository_access_mode',
            mtMap.passthrough()
          ),
          branchName: mtMap.objectField('branch_name', mtMap.passthrough()),
          prName: mtMap.objectField('pr_name', mtMap.passthrough()),
          prDescription: mtMap.objectField(
            'pr_description',
            mtMap.passthrough()
          ),
          commitMessage: mtMap.objectField(
            'commit_message',
            mtMap.passthrough()
          ),
          errorMessage: mtMap.objectField('error_message', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          startedAt: mtMap.objectField('started_at', mtMap.date()),
          completedAt: mtMap.objectField('completed_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    startedAt: mtMap.objectField('started_at', mtMap.date()),
    completedAt: mtMap.objectField('completed_at', mtMap.date())
  });

