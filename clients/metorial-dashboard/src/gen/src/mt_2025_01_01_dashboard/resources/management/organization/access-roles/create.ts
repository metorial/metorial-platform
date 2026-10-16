import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessRolesCreateOutput = {
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

export let mapManagementOrganizationAccessRolesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationAccessRolesCreateOutput>(
    ['organization_id', 'is_admin', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationAccessRolesCreateBody = {
  name: string;
  description?: string | undefined;
  scopes?: string[] | undefined;
  message?: string | undefined;
};

export let mapManagementOrganizationAccessRolesCreateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessRolesCreateBody>(0);
