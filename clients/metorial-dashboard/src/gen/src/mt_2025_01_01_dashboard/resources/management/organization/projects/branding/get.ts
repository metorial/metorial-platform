import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationProjectsBrandingGetOutput = {
  object: 'project.brand';
  id: string;
  identifier: string;
  name: string;
  imageUrl: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationProjectsBrandingGetOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationProjectsBrandingGetOutput>(
    ['image_url', 'project_id', 'created_at', 'updated_at'],
    1
  );
