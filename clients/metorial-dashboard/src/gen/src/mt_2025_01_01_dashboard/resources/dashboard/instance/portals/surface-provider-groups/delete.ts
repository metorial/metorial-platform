import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsSurfaceProviderGroupsDeleteOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsDeleteOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsDeleteOutput>(
    8
  );
