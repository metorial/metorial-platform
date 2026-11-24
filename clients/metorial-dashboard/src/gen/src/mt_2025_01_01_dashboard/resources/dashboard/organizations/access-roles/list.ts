import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAccessRolesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsAccessRolesListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAccessRolesListOutput>(
    [7, [1, ['organization_id', 'is_admin', 'created_at', 'updated_at']]],
    1
  );

export type DashboardOrganizationsAccessRolesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAccessRolesListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAccessRolesListQuery>(0);
