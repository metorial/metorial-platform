import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderGroupsUpdateOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderGroupsUpdateOutput>(8);

export type ManagementInstanceProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapManagementInstanceProviderGroupsUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderGroupsUpdateBody>(0);
