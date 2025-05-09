import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationProjectsCreateOutput = {
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsCreateOutput =
  mtMap.object<ManagementOrganizationProjectsCreateOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementOrganizationProjectsCreateBody = { name: string };

export let mapManagementOrganizationProjectsCreateBody =
  mtMap.object<ManagementOrganizationProjectsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

