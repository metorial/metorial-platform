import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsSurfaceProviderGroupsListOutput = {
  items: {
    object: 'consumer.surface.provider_group';
    id: string;
    name: string;
    description: string | null;
    index: number;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsListOutput>(
    [7, 8]
  );

export type DashboardInstancePortalsSurfaceProviderGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstancePortalsSurfaceProviderGroupsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsListQuery>(
    0
  );
