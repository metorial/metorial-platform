import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderGroupsGetOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderGroupsGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsGetOutput>(8);
