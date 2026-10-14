import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsProjectsUpdateOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsUpdateOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsProjectsUpdateBody = {
  name?: string | undefined;
  magicMcpSessionDurationMinutes?: number | undefined;
};

export let mapDashboardOrganizationsProjectsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsUpdateBody>([
    'magic_mcp_session_duration_minutes'
  ]);
