import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAccessRolesGetOutput = {
  object: 'management.access_role';
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  isAdmin: boolean;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsAccessRolesGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsAccessRolesGetOutput>(
    ['organization_id', 'is_admin', 'created_at', 'updated_at'],
    1
  );
