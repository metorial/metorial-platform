import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerAgentsGetOutput = {
  object: 'consumer.activity_agent';
  agent: {
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
  };
  magicMcpEndpoints: {
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
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export let mapConsumerAgentsGetOutput =
  /* @__PURE__ */ mapObject<ConsumerAgentsGetOutput>(
    [
      [
        'agent',
        0,
        [1, ['actor_id', 'created_at', 'updated_at', 'archived_at']]
      ],
      [
        'magic_mcp_endpoints',
        1,
        [
          2,
          [
            1,
            [
              ['servers', 0, [2, [3, [[0, [1, ['tool_filters']]]]]]],
              'created_at',
              'updated_at'
            ]
          ]
        ]
      ]
    ],
    1
  );
