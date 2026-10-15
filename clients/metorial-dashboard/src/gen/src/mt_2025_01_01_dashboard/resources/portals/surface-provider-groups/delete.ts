import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PortalsSurfaceProviderGroupsDeleteOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsSurfaceProviderGroupsDeleteOutput =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsDeleteOutput>(8);
