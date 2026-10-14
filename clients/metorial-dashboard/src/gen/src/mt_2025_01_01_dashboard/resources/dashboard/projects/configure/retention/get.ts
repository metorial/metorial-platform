import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureRetentionGetOutput = {
  object: 'organization.project.retention_configuration';
  projectId: string;
  logRetentionInDays: number;
  enforceSessionExpiry: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureRetentionGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureRetentionGetOutput>(
    [
      'project_id',
      'log_retention_in_days',
      'enforce_session_expiry',
      'updated_at'
    ],
    1
  );
