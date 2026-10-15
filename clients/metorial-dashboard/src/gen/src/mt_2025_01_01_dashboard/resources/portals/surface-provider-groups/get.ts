import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PortalsSurfaceProviderGroupsGetOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsSurfaceProviderGroupsGetOutput =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsGetOutput>(8);
