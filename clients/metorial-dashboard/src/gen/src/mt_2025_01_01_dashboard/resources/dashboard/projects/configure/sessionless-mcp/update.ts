import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureSessionlessMcpUpdateOutput = {
  object: 'organization.project.sessionless_mcp_configuration';
  projectId: string;
  sessionlessMcpEnabled: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureSessionlessMcpUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureSessionlessMcpUpdateOutput>(
    ['project_id', 'sessionless_mcp_enabled', 'updated_at'],
    1
  );

export type DashboardProjectsConfigureSessionlessMcpUpdateBody = {
  sessionlessMcpEnabled: boolean;
};

export let mapDashboardProjectsConfigureSessionlessMcpUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureSessionlessMcpUpdateBody>([
    'sessionless_mcp_enabled'
  ]);
