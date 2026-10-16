import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsSurfaceProviderGroupsUpdateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsUpdateOutput>(
    8
  );

export type ManagementInstancePortalsSurfaceProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  index?: number | undefined;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsUpdateBody>(
    0
  );
