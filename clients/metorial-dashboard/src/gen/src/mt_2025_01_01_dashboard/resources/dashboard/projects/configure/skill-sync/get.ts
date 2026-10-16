import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureSkillSyncGetOutput = {
  object: 'organization.project.skill_sync_configuration';
  projectId: string;
  gitLfsThresholdBytes: number | null;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureSkillSyncGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureSkillSyncGetOutput>(
    ['project_id', 'git_lfs_threshold_bytes', 'updated_at'],
    1
  );
