import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpEndpointsRemoveServersOutput = {
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
} & {
  consumerIntegrationEndpoints: {
    object: 'consumer.integration_endpoint';
    id: string;
    isManaged: boolean;
    consumerId: string;
    consumerProfileId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export let mapDashboardInstanceMagicMcpEndpointsRemoveServersOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpEndpointsRemoveServersOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              ['servers', 0, [2, [3, [[0, [1, ['tool_filters']]]]]]],
              'enable_skill_editing',
              'created_at',
              'updated_at',
              [
                'consumer_integration_endpoints',
                1,
                [
                  2,
                  [
                    1,
                    [
                      'is_managed',
                      'consumer_id',
                      'consumer_profile_id',
                      'created_at',
                      'updated_at'
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceMagicMcpEndpointsRemoveServersBody = {
  magicMcpServerIds: string[];
};

export let mapDashboardInstanceMagicMcpEndpointsRemoveServersBody =
  /* @__PURE__ */ mapObject<DashboardInstanceMagicMcpEndpointsRemoveServersBody>(
    ['magic_mcp_server_ids']
  );
