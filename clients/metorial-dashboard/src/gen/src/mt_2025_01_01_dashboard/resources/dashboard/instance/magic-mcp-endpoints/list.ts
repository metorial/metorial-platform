import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpEndpointsListOutput = {
  items: {
    object: 'magic_mcp.endpoint';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    slug: string;
    url: string;
    servers: ({
      object: 'magic_mcp.server#preview';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      name: string | null;
      description: string | null;
    } & {
      toolFilters:
        | (
            | { type: 'tool_keys'; keys: string[] }
            | { type: 'tool_categories'; keys: string[] }
            | { type: 'tool_regex'; pattern: string }
            | { type: 'resource_regex'; pattern: string }
            | { type: 'resource_uris'; uris: string[] }
            | { type: 'prompt_keys'; keys: string[] }
            | { type: 'prompt_regex'; pattern: string }
          )
        | (
            | { type: 'tool_keys'; keys: string[] }
            | { type: 'tool_categories'; keys: string[] }
            | { type: 'tool_regex'; pattern: string }
            | { type: 'resource_regex'; pattern: string }
            | { type: 'resource_uris'; uris: string[] }
            | { type: 'prompt_keys'; keys: string[] }
            | { type: 'prompt_regex'; pattern: string }
          )[]
        | null;
    })[];
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    enableSkillEditing: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceMagicMcpEndpointsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpEndpointsListOutput>(
    [
      7,
      [
        1,
        [
          ['servers', 0, [2, [3, [[0, [1, ['tool_filters']]]]]]],
          'enable_skill_editing',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceMagicMcpEndpointsListQuery = {
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
  magicMcpServerId?: string | string[] | undefined;
  search?: string | undefined;
};

export let mapDashboardInstanceMagicMcpEndpointsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpEndpointsListQuery>([
    3,
    [[0, [1, ['magic_mcp_server_id']]]]
  ]);
