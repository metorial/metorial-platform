import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsSurfaceProviderGroupsGetOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsGetOutput>(
    8
  );
