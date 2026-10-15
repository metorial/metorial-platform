import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsSurfaceProviderGroupsCreateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsCreateOutput>(
    8
  );

export type DashboardInstancePortalsSurfaceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsCreateBody>(
    0
  );
