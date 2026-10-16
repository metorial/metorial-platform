import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PortalsSurfaceProviderGroupsListOutput = {
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

export let mapPortalsSurfaceProviderGroupsListOutput =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsListOutput>([7, 8]);

export type PortalsSurfaceProviderGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapPortalsSurfaceProviderGroupsListQuery =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsListQuery>(0);
