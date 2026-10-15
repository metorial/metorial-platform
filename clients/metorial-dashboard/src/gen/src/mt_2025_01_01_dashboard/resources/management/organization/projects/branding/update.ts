import { mapObject } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsBrandingUpdateOutput>(
    ['image_url', 'project_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationProjectsBrandingUpdateBody = {
  name?: string | undefined;
  imageFileId?: string | null | undefined;
};

export let mapManagementOrganizationProjectsBrandingUpdateBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsBrandingUpdateBody>([
    'image_file_id'
  ]);
