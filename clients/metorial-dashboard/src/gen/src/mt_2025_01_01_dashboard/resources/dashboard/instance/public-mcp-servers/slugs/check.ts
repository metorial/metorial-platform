import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePublicMcpServersSlugsCheckOutput = {
  object: 'provider.public_mcp_server.slug_availability';
  slug: string;
  isAvailable: boolean;
};

export let mapDashboardInstancePublicMcpServersSlugsCheckOutput =
  /* @__PURE__ */ mapObject<DashboardInstancePublicMcpServersSlugsCheckOutput>([
    'is_available'
  ]);

export type DashboardInstancePublicMcpServersSlugsCheckQuery = { slug: string };

export let mapDashboardInstancePublicMcpServersSlugsCheckQuery =
  /* @__PURE__ */ createMapper<DashboardInstancePublicMcpServersSlugsCheckQuery>(
    0
  );
