import { mapObject } from '@metorial/util-resource-mapper/compact';

export type MagicMcpTokensAddGroupsOutput = {
  object: 'magic_mcp.token';
  id: string;
  status: 'active' | 'deleted';
  secret: string;
  name: string | null;
  description: string | null;
  server: {
    object: 'magic_mcp.server#preview';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string | null;
    description: string | null;
  } | null;
  endpoint: {
    object: 'magic_mcp.endpoint#preview';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    name: string | null;
    description: string | null;
  } | null;
  groups: {
    object: 'magic_mcp.group';
    id: string;
    status: 'active' | 'deleted' | 'archived';
    slug: string;
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapMagicMcpTokensAddGroupsOutput =
  /* @__PURE__ */ mapObject<MagicMcpTokensAddGroupsOutput>(
    [['groups', 0, [2, 8]], 'created_at', 'updated_at'],
    1
  );

export type MagicMcpTokensAddGroupsBody = { magicMcpGroupIds: string[] };

export let mapMagicMcpTokensAddGroupsBody =
  /* @__PURE__ */ mapObject<MagicMcpTokensAddGroupsBody>([
    'magic_mcp_group_ids'
  ]);
