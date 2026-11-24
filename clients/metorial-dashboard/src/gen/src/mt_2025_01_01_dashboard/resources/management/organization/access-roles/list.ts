import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessRolesListOutput = {
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

export let mapManagementOrganizationAccessRolesListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessRolesListOutput>(
    [7, [1, ['organization_id', 'is_admin', 'created_at', 'updated_at']]],
    1
  );

export type ManagementOrganizationAccessRolesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAccessRolesListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessRolesListQuery>(0);
