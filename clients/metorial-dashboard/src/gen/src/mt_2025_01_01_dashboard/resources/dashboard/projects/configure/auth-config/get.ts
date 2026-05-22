import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureAuthConfigGetOutput = {
  object: 'organization.project.auth_config_configuration';
  projectId: string;
  allowAuthConfigExport: boolean;
  allowAuthConfigImport: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureAuthConfigGetOutput =
  mtMap.object<DashboardProjectsConfigureAuthConfigGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    allowAuthConfigExport: mtMap.objectField(
      'allow_auth_config_export',
      mtMap.passthrough()
    ),
    allowAuthConfigImport: mtMap.objectField(
      'allow_auth_config_import',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

