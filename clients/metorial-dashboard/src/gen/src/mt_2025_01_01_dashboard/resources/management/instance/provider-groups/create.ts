import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderGroupsCreateOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderGroupsCreateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderGroupsCreateOutput>(8);

export type ManagementInstanceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapManagementInstanceProviderGroupsCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderGroupsCreateBody>(0);
