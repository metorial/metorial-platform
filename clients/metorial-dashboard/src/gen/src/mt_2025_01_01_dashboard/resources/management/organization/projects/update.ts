import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<ManagementOrganizationProjectsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementOrganizationProjectsUpdateBody = {
  name?: string | undefined;
};

export let mapManagementOrganizationProjectsUpdateBody =
  mtMap.object<ManagementOrganizationProjectsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

