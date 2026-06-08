import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureRetentionGetOutput = {
  object: 'organization.project.retention_configuration';
  projectId: string;
  logRetentionInDays: number;
  enforceSessionExpiry: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureRetentionGetOutput =
  mtMap.object<DashboardProjectsConfigureRetentionGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    logRetentionInDays: mtMap.objectField(
      'log_retention_in_days',
      mtMap.passthrough()
    ),
    enforceSessionExpiry: mtMap.objectField(
      'enforce_session_expiry',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

