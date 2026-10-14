import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpGroupsGetOutput = {
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

export let mapDashboardInstanceMagicMcpGroupsGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsGetOutput>(8);
