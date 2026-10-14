import { createMapper } from '@metorial/util-resource-mapper/compact';

export type MagicMcpGroupsDeleteOutput = {
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

export let mapMagicMcpGroupsDeleteOutput =
  /* @__PURE__ */ createMapper<MagicMcpGroupsDeleteOutput>(8);
