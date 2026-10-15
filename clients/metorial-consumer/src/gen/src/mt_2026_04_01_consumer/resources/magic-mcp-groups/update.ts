import { createMapper } from '@metorial/util-resource-mapper/compact';

export type MagicMcpGroupsUpdateOutput = {
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

export let mapMagicMcpGroupsUpdateOutput =
  /* @__PURE__ */ createMapper<MagicMcpGroupsUpdateOutput>(8);

export type MagicMcpGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapMagicMcpGroupsUpdateBody =
  /* @__PURE__ */ createMapper<MagicMcpGroupsUpdateBody>(0);
