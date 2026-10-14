import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type MagicMcpGroupsAddServersOutput = {
  object: 'magic_mcp.group';
  id: string;
  status: 'active' | 'deleted' | 'archived';
  slug: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapMagicMcpGroupsAddServersOutput =
  /* @__PURE__ */ createMapper<MagicMcpGroupsAddServersOutput>(8);

export type MagicMcpGroupsAddServersBody = { magicMcpServerIds: string[] };

export let mapMagicMcpGroupsAddServersBody =
  /* @__PURE__ */ mapObject<MagicMcpGroupsAddServersBody>([
    'magic_mcp_server_ids'
  ]);
