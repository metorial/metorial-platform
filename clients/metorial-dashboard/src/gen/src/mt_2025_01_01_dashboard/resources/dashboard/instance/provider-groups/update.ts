import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderGroupsUpdateOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsUpdateOutput>(8);

export type DashboardInstanceProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapDashboardInstanceProviderGroupsUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsUpdateBody>(0);
