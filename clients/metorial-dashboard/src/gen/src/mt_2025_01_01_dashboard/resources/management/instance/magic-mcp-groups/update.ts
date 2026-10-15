import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpGroupsUpdateOutput = {
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

export let mapManagementInstanceMagicMcpGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceMagicMcpGroupsUpdateOutput>(8);

export type ManagementInstanceMagicMcpGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceMagicMcpGroupsUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceMagicMcpGroupsUpdateBody>(0);
