import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpGroupsAddServersOutput = {
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

export let mapDashboardInstanceMagicMcpGroupsAddServersOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsAddServersOutput>(
    8
  );

export type DashboardInstanceMagicMcpGroupsAddServersBody = {
  magicMcpServerIds: string[];
};

export let mapDashboardInstanceMagicMcpGroupsAddServersBody =
  /* @__PURE__ */ mapObject<DashboardInstanceMagicMcpGroupsAddServersBody>([
    'magic_mcp_server_ids'
  ]);
