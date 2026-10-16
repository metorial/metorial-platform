import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsSurfaceProviderGroupsUpdateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsUpdateOutput>(
    8
  );

export type DashboardInstancePortalsSurfaceProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  index?: number | undefined;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsUpdateBody>(
    0
  );
