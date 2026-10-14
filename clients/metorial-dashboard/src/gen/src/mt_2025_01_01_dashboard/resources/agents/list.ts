import { createMapper } from '@metorial/util-resource-mapper/compact';

export type AgentsListOutput = {
  items: {
    object: 'agent';
    id: string;
    type: 'mcp_client' | 'custom' | 'tool_call';
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    slug: string;
    metadata: Record<string, any> | null;
    actorId: string;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapAgentsListOutput = /* @__PURE__ */ createMapper<AgentsListOutput>(
  [7, [1, ['actor_id', 'created_at', 'updated_at', 'archived_at']]],
  1
);

export type AgentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  type?:
    | 'mcp_client'
    | 'custom'
    | 'tool_call'
    | ('mcp_client' | 'custom' | 'tool_call')[]
    | undefined;
  id?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapAgentsListQuery = /* @__PURE__ */ createMapper<AgentsListQuery>([
  3,
  [
    [
      0,
      [
        1,
        [
          ['created_at', 1, 5],
          ['updated_at', 1, 5]
        ]
      ]
    ]
  ]
]);
