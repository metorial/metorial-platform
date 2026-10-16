import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderGroupsRemoveListingOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderGroupsRemoveListingOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderGroupsRemoveListingOutput>(
    8
  );
