import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderCollectionsGetOutput = {
  object: 'provider.listing_collection';
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderCollectionsGetOutput =
  /* @__PURE__ */ createMapper<ProviderCollectionsGetOutput>(8);
