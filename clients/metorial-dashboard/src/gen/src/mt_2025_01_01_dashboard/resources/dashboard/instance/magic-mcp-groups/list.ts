import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpGroupsListOutput = {
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

export let mapDashboardInstanceMagicMcpGroupsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsListOutput>([
    7, 8
  ]);

export type DashboardInstanceMagicMcpGroupsListQuery = {
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

export let mapDashboardInstanceMagicMcpGroupsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpGroupsListQuery>(0);
