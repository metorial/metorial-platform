import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAccessRolesCreateOutput = {
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

export let mapDashboardOrganizationsAccessRolesCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsAccessRolesCreateOutput>(
    ['organization_id', 'is_admin', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsAccessRolesCreateBody = {
  name: string;
  description?: string | undefined;
  scopes?: string[] | undefined;
  message?: string | undefined;
};

export let mapDashboardOrganizationsAccessRolesCreateBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAccessRolesCreateBody>(0);
