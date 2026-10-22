import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpEndpointsCreateOutput = {
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
};

export let mapDashboardInstanceMagicMcpEndpointsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceMagicMcpEndpointsCreateOutput>(
    [
      ['servers', 0, [2, [3, [[0, [1, ['tool_filters']]]]]]],
      'enable_skill_editing',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceMagicMcpEndpointsCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  consumerProfileId?: string | undefined;
  skillPluginId?: string | undefined;
  enableSkillEditing?: boolean | undefined;
  magicMcpServers?:
    | {
        magicMcpServerId: string;
        toolFilters?:
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
          | null
          | undefined;
      }[]
    | undefined;
};

export let mapDashboardInstanceMagicMcpEndpointsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceMagicMcpEndpointsCreateBody>([
    'consumer_profile_id',
    'skill_plugin_id',
    'enable_skill_editing',
    ['magic_mcp_servers', 1, [2, [1, ['magic_mcp_server_id', 'tool_filters']]]]
  ]);
