import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderCollectionsGetOutput = {
  object: 'provider.listing_collection';
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderCollectionsGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderCollectionsGetOutput>(
    8
  );
