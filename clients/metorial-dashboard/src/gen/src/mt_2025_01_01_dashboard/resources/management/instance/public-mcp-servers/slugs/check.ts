import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePublicMcpServersSlugsCheckOutput = {
  object: 'provider.public_mcp_server.slug_availability';
  slug: string;
  isAvailable: boolean;
};

export let mapManagementInstancePublicMcpServersSlugsCheckOutput =
  /* @__PURE__ */ mapObject<ManagementInstancePublicMcpServersSlugsCheckOutput>(
    ['is_available']
  );

export type ManagementInstancePublicMcpServersSlugsCheckQuery = {
  slug: string;
};

export let mapManagementInstancePublicMcpServersSlugsCheckQuery =
  /* @__PURE__ */ createMapper<ManagementInstancePublicMcpServersSlugsCheckQuery>(
    0
  );
