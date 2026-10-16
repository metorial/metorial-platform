import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderGroupsGetOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderGroupsGetOutput =
  /* @__PURE__ */ createMapper<ProviderGroupsGetOutput>(8);
