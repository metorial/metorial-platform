import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpTokensUpdateOutput = {
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

export let mapDashboardInstanceMagicMcpTokensUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceMagicMcpTokensUpdateOutput>(
    [['groups', 0, [2, 8]], 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceMagicMcpTokensUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceMagicMcpTokensUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpTokensUpdateBody>(0);
