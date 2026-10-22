import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpEndpointsRemoveServersOutput = {
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

export let mapManagementInstanceMagicMcpEndpointsRemoveServersOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpEndpointsRemoveServersOutput>(
    [
      ['servers', 0, [2, [3, [[0, [1, ['tool_filters']]]]]]],
      'enable_skill_editing',
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceMagicMcpEndpointsRemoveServersBody = {
  magicMcpServerIds: string[];
};

export let mapManagementInstanceMagicMcpEndpointsRemoveServersBody =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpEndpointsRemoveServersBody>(
    ['magic_mcp_server_ids']
  );
