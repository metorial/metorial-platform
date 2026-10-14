import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderGroupsUpdateOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<ProviderGroupsUpdateOutput>(8);

export type ProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapProviderGroupsUpdateBody =
  /* @__PURE__ */ createMapper<ProviderGroupsUpdateBody>(0);
