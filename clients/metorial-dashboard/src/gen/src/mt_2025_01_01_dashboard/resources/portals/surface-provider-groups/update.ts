import { createMapper } from '@metorial/util-resource-mapper/compact';

export type PortalsSurfaceProviderGroupsUpdateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsSurfaceProviderGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsUpdateOutput>(8);

export type PortalsSurfaceProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  index?: number | undefined;
};

export let mapPortalsSurfaceProviderGroupsUpdateBody =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsUpdateBody>(0);
