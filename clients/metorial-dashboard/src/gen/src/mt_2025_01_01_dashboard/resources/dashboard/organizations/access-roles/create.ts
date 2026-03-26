import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsAccessRolesCreateOutput = {
  object: 'management.access_role';
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  isAdmin: boolean;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsAccessRolesCreateOutput =
  mtMap.object<DashboardOrganizationsAccessRolesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    isAdmin: mtMap.objectField('is_admin', mtMap.passthrough()),
    scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough())),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsAccessRolesCreateBody = {
  name: string;
  description?: string | undefined;
  scopes?: string[] | undefined;
  message?: string | undefined;
};

export let mapDashboardOrganizationsAccessRolesCreateBody =
  mtMap.object<DashboardOrganizationsAccessRolesCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough())),
    message: mtMap.objectField('message', mtMap.passthrough())
  });

