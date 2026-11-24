import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAccessPoliciesVersionsOutput = {
  items: {
    object: 'management.access_policy_version';
    id: string;
    accessPolicyId: string;
    index: number;
    message: string | null;
    document: {
      access: {
        target: string;
        scopes?: string[] | undefined;
        roles?: string[] | undefined;
      }[];
    };
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationAccessPoliciesVersionsOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessPoliciesVersionsOutput>(
    [7, [1, ['access_policy_id', 'created_at']]],
    1
  );

export type ManagementOrganizationAccessPoliciesVersionsQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAccessPoliciesVersionsQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationAccessPoliciesVersionsQuery>(
    0
  );
