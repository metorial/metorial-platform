import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationProjectsListOutput = {
  items: {
    object: 'organization.project';
    id: string;
    status: 'active' | 'deleted';
    slug: string;
    name: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationProjectsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationProjectsListOutput>(
    [7, [1, ['organization_id', 'created_at', 'updated_at']]],
    1
  );

export type ManagementOrganizationProjectsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { teamId?: string | string[] | undefined };

export let mapManagementOrganizationProjectsListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationProjectsListQuery>([
    3,
    [[0, [1, ['team_id']]]]
  ]);
