import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureIntegrationNamingUpdateOutput = {
  object: 'organization.project.integration_naming_configuration';
  projectId: string;
  useIntegrationNameInToolNames: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureIntegrationNamingUpdateOutput =
  mtMap.object<DashboardProjectsConfigureIntegrationNamingUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    useIntegrationNameInToolNames: mtMap.objectField(
      'use_integration_name_in_tool_names',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardProjectsConfigureIntegrationNamingUpdateBody = {
  useIntegrationNameInToolNames?: boolean | undefined;
};

export let mapDashboardProjectsConfigureIntegrationNamingUpdateBody =
  mtMap.object<DashboardProjectsConfigureIntegrationNamingUpdateBody>({
    useIntegrationNameInToolNames: mtMap.objectField(
      'use_integration_name_in_tool_names',
      mtMap.passthrough()
    )
  });

