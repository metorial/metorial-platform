import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpGroupsCreateOutput = {
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

export let mapManagementInstanceMagicMcpGroupsCreateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceMagicMcpGroupsCreateOutput>(8);

export type ManagementInstanceMagicMcpGroupsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceMagicMcpGroupsCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceMagicMcpGroupsCreateBody>(0);
