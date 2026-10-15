import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpGroupsUpdateOutput = {
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

export let mapDashboardInstanceMagicMcpGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsUpdateOutput>(8);

export type DashboardInstanceMagicMcpGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceMagicMcpGroupsUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsUpdateBody>(0);
