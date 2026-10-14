import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureSkillSyncUpdateOutput = {
  object: 'organization.project.skill_sync_configuration';
  projectId: string;
  gitLfsThresholdBytes: number | null;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureSkillSyncUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureSkillSyncUpdateOutput>(
    ['project_id', 'git_lfs_threshold_bytes', 'updated_at'],
    1
  );

export type DashboardProjectsConfigureSkillSyncUpdateBody = {
  gitLfsThresholdBytes?: number | null | undefined;
};

export let mapDashboardProjectsConfigureSkillSyncUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureSkillSyncUpdateBody>([
    'git_lfs_threshold_bytes'
  ]);
