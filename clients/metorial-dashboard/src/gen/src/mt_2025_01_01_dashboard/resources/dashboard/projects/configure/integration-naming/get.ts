import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureIntegrationNamingGetOutput = {
  object: 'organization.project.integration_naming_configuration';
  projectId: string;
  useIntegrationNameInToolNames: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureIntegrationNamingGetOutput =
  mtMap.object<DashboardProjectsConfigureIntegrationNamingGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    useIntegrationNameInToolNames: mtMap.objectField(
      'use_integration_name_in_tool_names',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

