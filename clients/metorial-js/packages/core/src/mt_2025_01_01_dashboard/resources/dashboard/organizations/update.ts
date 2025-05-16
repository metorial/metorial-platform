import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsUpdateOutput = {
  object: 'organization';
  id: string;
  status: 'active' | 'deleted';
  type: 'default';
  slug: string;
  name: string;
  organizationId: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsUpdateOutput =
  mtMap.object<DashboardOrganizationsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsUpdateBody = { name?: string | undefined };

export let mapDashboardOrganizationsUpdateBody =
  mtMap.object<DashboardOrganizationsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

