import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessPoliciesUpdateOutput = {
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

export let mapManagementOrganizationAccessPoliciesUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationAccessPoliciesUpdateOutput>(
    ['organization_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementOrganizationAccessPoliciesUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  document?:
    | {
        access: {
          target: string;
          scopes?: string[] | undefined;
          roles?: string[] | undefined;
        }[];
      }
    | undefined;
  message?: string | undefined;
};

export let mapManagementOrganizationAccessPoliciesUpdateBody =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessPoliciesUpdateBody>(
    0
  );
