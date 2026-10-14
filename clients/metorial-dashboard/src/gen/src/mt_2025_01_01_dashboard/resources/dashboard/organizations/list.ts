import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsListOutput = {
  items: {
    object: 'organization';
    id: string;
    type: 'default';
    slug: string;
    name: string;
    imageUrl: string;
    magicMcpOrigin: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsListOutput>(
    [7, [1, ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at']]],
    1
  );

export type DashboardOrganizationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsListQuery>(0);
