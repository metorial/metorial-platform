import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsProjectsDeleteOutput = {
  object: 'organization.project';
  id: string;
  status: 'active' | 'deleted';
  slug: string;
  name: string;
  assistantEnabled: boolean;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsProjectsDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsProjectsDeleteOutput>(
    ['assistant_enabled', 'organization_id', 'created_at', 'updated_at'],
    1
  );
