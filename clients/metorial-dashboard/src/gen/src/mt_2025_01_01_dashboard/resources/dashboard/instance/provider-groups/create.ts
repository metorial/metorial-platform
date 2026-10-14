import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderGroupsCreateOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderGroupsCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsCreateOutput>(8);

export type DashboardInstanceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapDashboardInstanceProviderGroupsCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsCreateBody>(0);
