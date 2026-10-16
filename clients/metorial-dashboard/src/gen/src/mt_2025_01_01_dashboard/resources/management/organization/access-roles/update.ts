import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessRolesUpdateOutput = {
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

export let mapManagementOrganizationAccessRolesUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationAccessRolesUpdateOutput>(
    ['organization_id', 'is_admin', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationAccessRolesUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  scopes?: string[] | undefined;
  message?: string | undefined;
};

export let mapManagementOrganizationAccessRolesUpdateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessRolesUpdateBody>(0);
