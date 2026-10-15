import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsSurfaceProviderGroupsRemoveListingOutput =
  {
    object: 'consumer.surface.provider_group';
    id: string;
    name: string;
    description: string | null;
    index: number;
    createdAt: Date;
    updatedAt: Date;
  };

export let mapManagementInstancePortalsSurfaceProviderGroupsRemoveListingOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsRemoveListingOutput>(
    8
  );
