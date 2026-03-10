import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationTeamsRolesUpdateOutput = {
  object: 'management.team.role';
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationTeamsRolesUpdateOutput =
  mtMap.object<ManagementOrganizationTeamsRolesUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    permissions: mtMap.objectField(
      'permissions',
      mtMap.array(mtMap.passthrough())
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementOrganizationTeamsRolesUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  permissions?: string[] | undefined;
};

export let mapManagementOrganizationTeamsRolesUpdateBody =
  mtMap.object<ManagementOrganizationTeamsRolesUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    permissions: mtMap.objectField(
      'permissions',
      mtMap.array(mtMap.passthrough())
    )
  });

