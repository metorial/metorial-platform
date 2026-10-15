import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpGroupsDeleteOutput = {
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

export let mapDashboardInstanceMagicMcpGroupsDeleteOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsDeleteOutput>(8);
