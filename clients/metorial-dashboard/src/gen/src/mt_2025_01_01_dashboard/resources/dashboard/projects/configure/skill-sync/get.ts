import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureSkillSyncGetOutput = {
  object: 'organization.project.skill_sync_configuration';
  projectId: string;
  gitLfsThresholdBytes: number | null;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureSkillSyncGetOutput =
  mtMap.object<DashboardProjectsConfigureSkillSyncGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    gitLfsThresholdBytes: mtMap.objectField(
      'git_lfs_threshold_bytes',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

