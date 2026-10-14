import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureIntegrationNamingGetOutput = {
  object: 'organization.project.integration_naming_configuration';
  projectId: string;
  useIntegrationNameInToolNames: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureIntegrationNamingGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureIntegrationNamingGetOutput>(
    ['project_id', 'use_integration_name_in_tool_names', 'updated_at'],
    1
  );
