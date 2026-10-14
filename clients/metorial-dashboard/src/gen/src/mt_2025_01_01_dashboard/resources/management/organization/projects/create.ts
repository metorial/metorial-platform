import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationProjectsCreateOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsCreateOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationProjectsCreateBody = {
  name: string;
  magicMcpSessionDurationMinutes?: number | undefined;
};

export let mapManagementOrganizationProjectsCreateBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsCreateBody>([
    'magic_mcp_session_duration_minutes'
  ]);
