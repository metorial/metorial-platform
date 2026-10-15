import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessRolesVersionsOutput = {
  items: {
    object: 'management.access_role_version';
    id: string;
    accessRoleId: string;
    index: number;
    scopes: string[];
    scopesAdded: string[];
    scopesRemoved: string[];
    message: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationAccessRolesVersionsOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessRolesVersionsOutput>(
    [
      7,
      [1, ['access_role_id', 'scopes_added', 'scopes_removed', 'created_at']]
    ],
    1
  );

export type ManagementOrganizationAccessRolesVersionsQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAccessRolesVersionsQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessRolesVersionsQuery>(
    0
  );
