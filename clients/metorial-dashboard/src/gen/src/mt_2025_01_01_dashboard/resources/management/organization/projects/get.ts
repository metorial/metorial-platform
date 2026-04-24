import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationProjectsGetOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  magicMcpSessionDurationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsGetOutput =
  mtMap.object<ManagementOrganizationProjectsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    magicMcpSessionDurationMinutes: mtMap.objectField(
      'magic_mcp_session_duration_minutes',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

