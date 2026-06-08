import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureRetentionUpdateOutput = {
  object: 'organization.project.retention_configuration';
  projectId: string;
  logRetentionInDays: number;
  enforceSessionExpiry: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureRetentionUpdateOutput =
  mtMap.object<DashboardProjectsConfigureRetentionUpdateOutput>({
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

export type DashboardProjectsConfigureRetentionUpdateBody = {
  logRetentionInDays?: number | undefined;
  enforceSessionExpiry?: boolean | undefined;
};

export let mapDashboardProjectsConfigureRetentionUpdateBody =
  mtMap.object<DashboardProjectsConfigureRetentionUpdateBody>({
    logRetentionInDays: mtMap.objectField(
      'log_retention_in_days',
      mtMap.passthrough()
    ),
    enforceSessionExpiry: mtMap.objectField(
      'enforce_session_expiry',
      mtMap.passthrough()
    )
  });

