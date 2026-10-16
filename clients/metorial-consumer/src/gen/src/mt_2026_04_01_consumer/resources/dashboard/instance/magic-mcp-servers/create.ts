import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceMagicMcpServersCreateOutput = {
  object: 'magic_mcp.server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  source: 'manual' | 'consumer_provider_template';
  providerManagementMode:
    | 'manual'
    | 'inherited_from_provider_template'
    | 'inherited_from_integration';
  endpoints: { id: string; alias: string; url: string }[];
  providerTemplateId: string | null;
  providers: {
    object: 'magic_mcp.server.provider';
    id: string;
    status: 'pending' | 'active' | 'archived' | 'deleted';
    magicMcpServerId: string;
    providerManagementMode:
      | 'manual'
      | 'inherited_from_provider_template'
      | 'inherited_from_integration';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    toolFilter:
      | { type: 'allow_all'; ignoreParentFilters: boolean }
      | {
          type: 'filter';
          filters: (
            | { type: 'tool_keys'; keys: string[] }
            | { type: 'tool_categories'; keys: string[] }
            | { type: 'tool_regex'; pattern: string }
            | { type: 'resource_regex'; pattern: string }
            | { type: 'resource_uris'; uris: string[] }
            | { type: 'prompt_keys'; keys: string[] }
            | { type: 'prompt_regex'; pattern: string }
          )[];
          ignoreParentFilters: boolean;
        }
      | null;
    provider: {
      object: 'provider#preview';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    };
    deployment: {
      object: 'provider.deployment#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    authMethod: {
      object: 'provider.capabilities.auth_method';
      id: string;
      type: 'oauth' | 'token' | 'custom';
      key: string;
      name: string;
      description: string | null;
      capabilities: Record<string, any>;
      inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      scopes:
        | {
            object: 'provider.capabilities.auth_method.scope';
            id: string;
            scope: string;
            name: string;
            description: string | null;
          }[]
        | null;
      adapters: string[] | null;
      providerId: string;
      providerSpecificationId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    authCredentials: {
      object: 'provider.auth_credentials';
      id: string;
      type: 'oauth';
      status: 'active' | 'archived' | 'deleted';
      isDefault: boolean;
      isManaged: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      scopes: string[] | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    config: {
      object: 'provider.config#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    authConfig: {
      object: 'provider.auth_config#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
} & {
  consumerIntegrations: {
    object: 'consumer.integration';
    id: string;
    isManaged: boolean;
    consumerId: string;
    consumerProfileId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export let mapDashboardInstanceMagicMcpServersCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceMagicMcpServersCreateOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_management_mode',
              'provider_template_id',
              [
                'providers',
                0,
                [
                  2,
                  [
                    1,
                    [
                      'magic_mcp_server_id',
                      'provider_management_mode',
                      [
                        'tool_filter',
                        1,
                        [3, [[0, [1, ['ignore_parent_filters']]]]]
                      ],
                      ['provider', 0, 8],
                      [
                        'deployment',
                        0,
                        [
                          1,
                          [
                            'is_default',
                            'provider_id',
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ],
                      [
                        'auth_method',
                        1,
                        [
                          1,
                          [
                            'input_schema',
                            'output_schema',
                            'provider_id',
                            'provider_specification_id',
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ],
                      [
                        'auth_credentials',
                        1,
                        [
                          1,
                          [
                            'is_default',
                            'is_managed',
                            'provider_id',
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ],
                      [
                        'config',
                        0,
                        [
                          1,
                          [
                            'is_default',
                            'provider_id',
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ],
                      [
                        'auth_config',
                        1,
                        [
                          1,
                          [
                            'is_default',
                            'provider_id',
                            'created_at',
                            'updated_at'
                          ]
                        ]
                      ],
                      'created_at',
                      'updated_at',
                      'archived_at'
                    ]
                  ]
                ]
              ],
              'created_at',
              'updated_at',
              [
                'consumer_integrations',
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

export type DashboardInstanceMagicMcpServersCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providerTemplateId?: string | undefined;
  integrationInstanceId?: string | undefined;
  consumerProfileId?: string | undefined;
};

export let mapDashboardInstanceMagicMcpServersCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceMagicMcpServersCreateBody>([
    'provider_template_id',
    'integration_instance_id',
    'consumer_profile_id'
  ]);
