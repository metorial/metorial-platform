import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsProjectsDeleteOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsDeleteOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );
