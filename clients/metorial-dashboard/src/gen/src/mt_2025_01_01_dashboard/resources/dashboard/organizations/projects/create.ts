import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsProjectsCreateOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsCreateOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsProjectsCreateBody = {
  name: string;
  magicMcpSessionDurationMinutes?: number | undefined;
};

export let mapDashboardOrganizationsProjectsCreateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsCreateBody>([
    'magic_mcp_session_duration_minutes'
  ]);
