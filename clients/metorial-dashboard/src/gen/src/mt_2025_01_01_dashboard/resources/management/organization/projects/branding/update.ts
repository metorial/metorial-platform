import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationProjectsBrandingUpdateOutput = {
  object: 'project.brand';
  id: string;
  identifier: string;
  name: string;
  imageUrl: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsBrandingUpdateOutput =
  mtMap.object<ManagementOrganizationProjectsBrandingUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementOrganizationProjectsBrandingUpdateBody = {
  name?: string | undefined;
  imageFileId?: string | null | undefined;
};

export let mapManagementOrganizationProjectsBrandingUpdateBody =
  mtMap.object<ManagementOrganizationProjectsBrandingUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    imageFileId: mtMap.objectField('image_file_id', mtMap.passthrough())
  });

