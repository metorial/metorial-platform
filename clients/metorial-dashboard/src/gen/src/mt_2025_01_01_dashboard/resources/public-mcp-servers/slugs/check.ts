import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type PublicMcpServersSlugsCheckOutput = {
  object: 'provider.public_mcp_server.slug_availability';
  slug: string;
  isAvailable: boolean;
};

export let mapPublicMcpServersSlugsCheckOutput =
  /* @__PURE__ */ mapObject<PublicMcpServersSlugsCheckOutput>(['is_available']);

export type PublicMcpServersSlugsCheckQuery = { slug: string };

export let mapPublicMcpServersSlugsCheckQuery =
  /* @__PURE__ */ createMapper<PublicMcpServersSlugsCheckQuery>(0);
