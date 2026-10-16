import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type MagicMcpGroupsRemoveServersOutput = {
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

export let mapMagicMcpGroupsRemoveServersOutput =
  /* @__PURE__ */ createMapper<MagicMcpGroupsRemoveServersOutput>(8);

export type MagicMcpGroupsRemoveServersBody = { magicMcpServerIds: string[] };

export let mapMagicMcpGroupsRemoveServersBody =
  /* @__PURE__ */ mapObject<MagicMcpGroupsRemoveServersBody>([
    'magic_mcp_server_ids'
  ]);
