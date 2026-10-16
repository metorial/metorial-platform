import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpGroupsCreateOutput = {
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

export let mapDashboardInstanceMagicMcpGroupsCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsCreateOutput>(8);

export type DashboardInstanceMagicMcpGroupsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceMagicMcpGroupsCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsCreateBody>(0);
