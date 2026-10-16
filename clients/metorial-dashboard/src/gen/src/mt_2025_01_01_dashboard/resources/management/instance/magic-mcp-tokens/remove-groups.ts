import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpTokensRemoveGroupsOutput = {
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

export let mapManagementInstanceMagicMcpTokensRemoveGroupsOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpTokensRemoveGroupsOutput>(
    [['groups', 0, [2, 8]], 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceMagicMcpTokensRemoveGroupsBody = {
  magicMcpGroupIds: string[];
};

export let mapManagementInstanceMagicMcpTokensRemoveGroupsBody =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpTokensRemoveGroupsBody>([
    'magic_mcp_group_ids'
  ]);
