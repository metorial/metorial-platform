import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardOrganizationsProjectsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsProjectsCreateBody = { name: string };

export let mapDashboardOrganizationsProjectsCreateBody =
  mtMap.object<DashboardOrganizationsProjectsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

