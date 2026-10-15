import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PortalsSurfaceProviderGroupsCreateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsSurfaceProviderGroupsCreateOutput =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsCreateOutput>(8);

export type PortalsSurfaceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapPortalsSurfaceProviderGroupsCreateBody =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsCreateBody>(0);
