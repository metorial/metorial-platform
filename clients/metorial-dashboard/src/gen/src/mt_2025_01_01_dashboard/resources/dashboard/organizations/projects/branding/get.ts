import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsProjectsBrandingGetOutput = {
  object: 'project.brand';
  id: string;
  identifier: string;
  name: string;
  imageUrl: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsBrandingGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsBrandingGetOutput>(
    ['image_url', 'project_id', 'created_at', 'updated_at'],
    1
  );
