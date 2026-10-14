import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAccessRolesDeleteOutput = {
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

export let mapDashboardOrganizationsAccessRolesDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsAccessRolesDeleteOutput>(
    ['organization_id', 'is_admin', 'created_at', 'updated_at'],
    1
  );
