import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureSessionlessMcpGetOutput = {
  object: 'organization.project.sessionless_mcp_configuration';
  projectId: string;
  sessionlessMcpEnabled: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureSessionlessMcpGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureSessionlessMcpGetOutput>(
    ['project_id', 'sessionless_mcp_enabled', 'updated_at'],
    1
  );
