import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationProjectsUpdateOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsUpdateOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationProjectsUpdateBody = {
  name?: string | undefined;
  magicMcpSessionDurationMinutes?: number | undefined;
};

export let mapManagementOrganizationProjectsUpdateBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsUpdateBody>([
    'magic_mcp_session_duration_minutes'
  ]);
