import { createMapper } from '@metorial/util-resource-mapper/compact';

export type MagicMcpGroupsListOutput = {
  items: {
    object: 'magic_mcp.group';
    id: string;
    status: 'active' | 'deleted' | 'archived';
    slug: string;
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapMagicMcpGroupsListOutput =
  /* @__PURE__ */ createMapper<MagicMcpGroupsListOutput>([7, 8]);

export type MagicMcpGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  search?: string | undefined;
  id?: string | string[] | undefined;
};

export let mapMagicMcpGroupsListQuery =
  /* @__PURE__ */ createMapper<MagicMcpGroupsListQuery>(0);
