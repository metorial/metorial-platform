import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAccessRolesUpdateOutput = {
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

export let mapDashboardOrganizationsAccessRolesUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsAccessRolesUpdateOutput>(
    ['organization_id', 'is_admin', 'created_at', 'updated_at'],
    1
  );

export type DashboardOrganizationsAccessRolesUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  scopes?: string[] | undefined;
  message?: string | undefined;
};

export let mapDashboardOrganizationsAccessRolesUpdateBody =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAccessRolesUpdateBody>(0);
