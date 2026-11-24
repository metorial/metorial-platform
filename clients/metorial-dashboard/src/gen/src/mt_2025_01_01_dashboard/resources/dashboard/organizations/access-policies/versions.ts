import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAccessPoliciesVersionsOutput = {
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

export let mapDashboardOrganizationsAccessPoliciesVersionsOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAccessPoliciesVersionsOutput>(
    [7, [1, ['access_policy_id', 'created_at']]],
    1
  );

export type DashboardOrganizationsAccessPoliciesVersionsQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAccessPoliciesVersionsQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAccessPoliciesVersionsQuery>(
    0
  );
