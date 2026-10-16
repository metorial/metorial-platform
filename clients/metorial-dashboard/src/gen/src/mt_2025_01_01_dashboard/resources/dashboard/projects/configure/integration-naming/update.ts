import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureIntegrationNamingUpdateOutput = {
  object: 'organization.project.integration_naming_configuration';
  projectId: string;
  useIntegrationNameInToolNames: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureIntegrationNamingUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureIntegrationNamingUpdateOutput>(
    ['project_id', 'use_integration_name_in_tool_names', 'updated_at'],
    1
  );

export type DashboardProjectsConfigureIntegrationNamingUpdateBody = {
  useIntegrationNameInToolNames?: boolean | undefined;
};

export let mapDashboardProjectsConfigureIntegrationNamingUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureIntegrationNamingUpdateBody>(
    ['use_integration_name_in_tool_names']
  );
