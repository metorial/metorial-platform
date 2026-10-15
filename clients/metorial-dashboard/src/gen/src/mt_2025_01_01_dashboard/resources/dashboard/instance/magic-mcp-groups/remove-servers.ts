import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpGroupsRemoveServersOutput = {
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

export let mapDashboardInstanceMagicMcpGroupsRemoveServersOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsRemoveServersOutput>(
    8
  );

export type DashboardInstanceMagicMcpGroupsRemoveServersBody = {
  magicMcpServerIds: string[];
};

export let mapDashboardInstanceMagicMcpGroupsRemoveServersBody =
  /* @__PURE__ */ mapObject<DashboardInstanceMagicMcpGroupsRemoveServersBody>([
    'magic_mcp_server_ids'
  ]);
