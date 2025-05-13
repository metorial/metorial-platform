import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsInstancesCreateOutput = {
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  type: 'development' | 'production';
  organizationId: string;
  project: {
    id: string;
    status: 'active' | 'deleted';
    slug: string;
    name: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsInstancesCreateOutput =
  mtMap.object<DashboardOrganizationsInstancesCreateOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    project: mtMap.objectField(
      'project',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        organizationId: mtMap.objectField(
          'organization_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsInstancesCreateBody = {
  name: string;
  type: 'development' | 'production';
  projectId: string;
};

export let mapDashboardOrganizationsInstancesCreateBody =
  mtMap.object<DashboardOrganizationsInstancesCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough())
  });

