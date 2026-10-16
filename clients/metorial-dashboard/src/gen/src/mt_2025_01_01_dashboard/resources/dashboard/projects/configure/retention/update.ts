import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureRetentionUpdateOutput = {
  object: 'organization.project.retention_configuration';
  projectId: string;
  logRetentionInDays: number;
  enforceSessionExpiry: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureRetentionUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureRetentionUpdateOutput>(
    [
      'project_id',
      'log_retention_in_days',
      'enforce_session_expiry',
      'updated_at'
    ],
    1
  );

export type DashboardProjectsConfigureRetentionUpdateBody = {
  logRetentionInDays?: number | undefined;
  enforceSessionExpiry?: boolean | undefined;
};

export let mapDashboardProjectsConfigureRetentionUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureRetentionUpdateBody>([
    'log_retention_in_days',
    'enforce_session_expiry'
  ]);
