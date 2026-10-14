import { createMapper } from '@metorial/util-resource-mapper/compact';

export type MagicMcpGroupsCreateOutput = {
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

export let mapMagicMcpGroupsCreateOutput =
  /* @__PURE__ */ createMapper<MagicMcpGroupsCreateOutput>(8);

export type MagicMcpGroupsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapMagicMcpGroupsCreateBody =
  /* @__PURE__ */ createMapper<MagicMcpGroupsCreateBody>(0);
