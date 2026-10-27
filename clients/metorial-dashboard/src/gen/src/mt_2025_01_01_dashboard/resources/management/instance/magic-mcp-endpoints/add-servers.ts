import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceMagicMcpEndpointsAddServersOutput = {
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
  access: {
    source: 'explorer' | null;
    type: 'public' | 'owner_locked';
    visibility: 'anyone' | 'owner';
    owner: {
      type: 'person' | 'agent' | 'consumer' | 'organization_member';
      name: string | null;
      imageUrl: string | null;
      email: string | null;
      organizationMember?: { id: string } | undefined;
      consumer?:
        { id: string; profileId: string; portalId: string | null } | undefined;
    } | null;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceMagicMcpEndpointsAddServersOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpEndpointsAddServersOutput>(
    [
      ['servers', 0, [2, [3, [[0, [1, ['tool_filters']]]]]]],
      'enable_skill_editing',
      [
        'access',
        0,
        [
          1,
          [
            [
              'owner',
              0,
              [
                1,
                [
                  'image_url',
                  'organization_member',
                  ['consumer', 0, [1, ['profile_id', 'portal_id']]]
                ]
              ]
            ]
          ]
        ]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceMagicMcpEndpointsAddServersBody = {
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

export let mapManagementInstanceMagicMcpEndpointsAddServersBody =
  /* @__PURE__ */ mapObject<ManagementInstanceMagicMcpEndpointsAddServersBody>([
    ['magic_mcp_servers', 1, [2, [1, ['magic_mcp_server_id', 'tool_filters']]]]
  ]);
