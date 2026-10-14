import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsSurfaceProviderGroupsCreateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsCreateOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsCreateOutput>(
    8
  );

export type ManagementInstancePortalsSurfaceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsCreateBody>(
    0
  );
