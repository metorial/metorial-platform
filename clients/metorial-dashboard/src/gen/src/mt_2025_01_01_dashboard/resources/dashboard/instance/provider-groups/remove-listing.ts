import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderGroupsRemoveListingOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderGroupsRemoveListingOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsRemoveListingOutput>(
    8
  );
