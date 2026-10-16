import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderGroupsCreateOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderGroupsCreateOutput =
  /* @__PURE__ */ createMapper<ProviderGroupsCreateOutput>(8);

export type ProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapProviderGroupsCreateBody =
  /* @__PURE__ */ createMapper<ProviderGroupsCreateBody>(0);
