import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderCollectionsGetOutput = {
  object: 'provider.listing_collection';
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderCollectionsGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderCollectionsGetOutput>(
    8
  );
