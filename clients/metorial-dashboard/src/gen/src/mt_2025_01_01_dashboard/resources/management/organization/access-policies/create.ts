import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessPoliciesCreateOutput = {
  object: 'management.access_policy';
  id: string;
  organizationId: string;
  type: 'everyone' | 'admin' | 'custom';
  name: string;
  slug: string;
  description: string | null;
  document: {
    access: {
      target: string;
      scopes?: string[] | undefined;
      roles?: string[] | undefined;
    }[];
  };
  roles: { id: string; name: string; slug: string }[];
  projects: { id: string; slug: string; name: string }[];
  instances: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationAccessPoliciesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationAccessPoliciesCreateOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationAccessPoliciesCreateBody = {
  name: string;
  description?: string | undefined;
  document: {
    access: {
      target: string;
      scopes?: string[] | undefined;
      roles?: string[] | undefined;
    }[];
  };
  message?: string | undefined;
};

export let mapManagementOrganizationAccessPoliciesCreateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessPoliciesCreateBody>(
    0
  );
