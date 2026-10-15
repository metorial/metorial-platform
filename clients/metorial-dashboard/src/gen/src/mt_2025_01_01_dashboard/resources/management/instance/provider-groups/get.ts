import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderGroupsGetOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderGroupsGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderGroupsGetOutput>(8);
