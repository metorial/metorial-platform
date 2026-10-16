import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderGroupsRemoveListingOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderGroupsRemoveListingOutput =
  /* @__PURE__ */ createMapper<ProviderGroupsRemoveListingOutput>(8);
