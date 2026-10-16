import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsProjectsBrandingUpdateOutput = {
  object: 'project.brand';
  id: string;
  identifier: string;
  name: string;
  imageUrl: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsBrandingUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsBrandingUpdateOutput>(
    ['image_url', 'project_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsProjectsBrandingUpdateBody = {
  name?: string | undefined;
  imageFileId?: string | null | undefined;
};

export let mapDashboardOrganizationsProjectsBrandingUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsBrandingUpdateBody>([
    'image_file_id'
  ]);
