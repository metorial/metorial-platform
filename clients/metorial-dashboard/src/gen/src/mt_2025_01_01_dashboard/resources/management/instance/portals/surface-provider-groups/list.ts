import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsSurfaceProviderGroupsListOutput = {
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

export let mapManagementInstancePortalsSurfaceProviderGroupsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsListOutput>(
    [7, 8]
  );

export type ManagementInstancePortalsSurfaceProviderGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstancePortalsSurfaceProviderGroupsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsListQuery>(
    0
  );
