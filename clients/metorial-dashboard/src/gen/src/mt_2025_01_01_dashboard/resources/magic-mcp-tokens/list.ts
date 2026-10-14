import { createMapper } from '@metorial/util-resource-mapper/compact';

export type MagicMcpTokensListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapMagicMcpTokensListOutput =
  /* @__PURE__ */ createMapper<MagicMcpTokensListOutput>(
    [7, [1, [['groups', 0, [2, 8]], 'created_at', 'updated_at']]],
    1
  );

export type MagicMcpTokensListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'deleted' | ('active' | 'deleted')[] | undefined;
  magicMcpGroupId?: string | string[] | undefined;
  magicMcpServerId?: string | string[] | undefined;
  magicMcpEndpointId?: string | string[] | undefined;
};

export let mapMagicMcpTokensListQuery =
  /* @__PURE__ */ createMapper<MagicMcpTokensListQuery>([
    3,
    [
      [
        0,
        [
          1,
          ['magic_mcp_group_id', 'magic_mcp_server_id', 'magic_mcp_endpoint_id']
        ]
      ]
    ]
  ]);
