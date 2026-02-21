import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsInstancesUpdateOutput = {
  object: 'organization.instance';
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  type: 'development' | 'production';
  createdAt: Date;
  updatedAt: Date;
  project: {
    object: 'organization.project';
    id: string;
    status: 'active' | 'deleted';
    slug: string;
    name: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

export let mapDashboardOrganizationsInstancesUpdateOutput =
  mtMap.object<DashboardOrganizationsInstancesUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    project: mtMap.objectField(
      'project',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
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
    )
  });

export type DashboardOrganizationsInstancesUpdateBody = {
  name?: string | undefined;
};

export let mapDashboardOrganizationsInstancesUpdateBody =
  mtMap.object<DashboardOrganizationsInstancesUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

