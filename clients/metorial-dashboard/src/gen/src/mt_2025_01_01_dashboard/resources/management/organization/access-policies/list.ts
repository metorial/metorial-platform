import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessPoliciesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationAccessPoliciesListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessPoliciesListOutput>(
    [7, [1, ['organization_id', 'created_at', 'updated_at']]],
    1
  );

export type ManagementOrganizationAccessPoliciesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAccessPoliciesListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessPoliciesListQuery>(
    0
  );
