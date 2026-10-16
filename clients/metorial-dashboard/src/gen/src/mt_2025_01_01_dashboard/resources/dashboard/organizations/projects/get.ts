import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsProjectsGetOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsGetOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );
