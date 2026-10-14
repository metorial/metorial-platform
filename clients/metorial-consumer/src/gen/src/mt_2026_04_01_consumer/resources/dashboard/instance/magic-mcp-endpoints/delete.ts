import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpEndpointsDeleteOutput = {
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
          | { type: 'tool_regex'; pattern: string }
          | { type: 'resource_regex'; pattern: string }
          | { type: 'resource_uris'; uris: string[] }
          | { type: 'prompt_keys'; keys: string[] }
          | { type: 'prompt_regex'; pattern: string }
        )
      | (
          | { type: 'tool_keys'; keys: string[] }
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

export let mapDashboardInstanceMagicMcpEndpointsDeleteOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpEndpointsDeleteOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              ['servers', 0, [2, [3, [[0, [1, ['tool_filters']]]]]]],
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
