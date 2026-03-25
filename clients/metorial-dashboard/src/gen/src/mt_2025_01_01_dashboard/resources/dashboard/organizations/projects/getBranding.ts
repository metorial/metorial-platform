import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsProjectsGetBrandingOutput = {
  object: 'project.brand';
  id: string;
  identifier: string;
  name: string;
  imageUrl: string | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsGetBrandingOutput =
  mtMap.object<DashboardOrganizationsProjectsGetBrandingOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });
