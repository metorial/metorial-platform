import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ConsumerProvidersGetOutput =
  | {
      object: 'consumer.provider';
      id: string;
      name: string;
      description: string | null;
      readme: string | null;
      type: 'provider_template';
      availability: 'available_now' | 'request_access';
      hasPendingAccessRequest: boolean;
      consumerAccessIds: string[];
      providerTemplate: {
        object: 'provider.template#preview';
        id: string;
        status: 'active' | 'archived' | 'deleted';
        name: string;
        description: string | null;
        metadata: Record<string, any>;
        integrationId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      provider: {
        object: 'provider';
        id: string;
        access: 'public' | 'tenant';
        status: 'active' | 'archived' | 'deleted';
        publisher: {
          object: 'provider.publisher';
          id: string;
          name: string;
          description: string | null;
          imageUrl: string;
          createdAt: Date;
          updatedAt: Date;
        };
        currentVersion: {
          object: 'provider.version';
          id: string;
          version: string;
          providerId: string;
          isCurrent: boolean;
          name: string;
          description: string | null;
          metadata: Record<string, any> | null;
          specificationId: string | null;
          createdAt: Date;
          updatedAt: Date;
        } | null;
        oauth: {
          status: 'enabled' | 'disabled';
          callbackUrl: string | null;
          autoRegistration: { status: 'supported' | 'unsupported' };
        } | null;
        identifier: string;
        name: string;
        description: string | null;
        slug: string;
        metadata: Record<string, any> | null;
        createdAt: Date;
        updatedAt: Date;
      };
      deployment: {
        object: 'provider.deployment#preview';
        id: string;
        name: string | null;
        description: string | null;
        isDefault: boolean;
        providerId: string;
        lockedVersionId: string | null;
      };
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
      configSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      authMethods: {
        object: 'provider.capabilities.auth_method';
        id: string;
        type: 'oauth' | 'token' | 'custom';
        key: string;
        name: string;
        description: string | null;
        capabilities: Record<string, any>;
        inputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
        outputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
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
      }[];
    }
  | {
      object: 'consumer.provider';
      id: string;
      name: string;
      description: string | null;
      readme: string | null;
      type: 'magic_mcp_server';
      availability: 'available_now' | 'request_access';
      hasPendingAccessRequest: boolean;
      consumerAccessIds: string[];
      magicMcpServer: {
        object: 'magic_mcp.server#preview';
        id: string;
        status: 'active' | 'archived' | 'deleted';
        name: string | null;
        description: string | null;
      };
    };

export let mapConsumerProvidersGetOutput =
  /* @__PURE__ */ createMapper<ConsumerProvidersGetOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'has_pending_access_request',
              'consumer_access_ids',
              [
                'provider_template',
                1,
                [1, ['integration_id', 'created_at', 'updated_at']]
              ],
              [
                'provider',
                0,
                [
                  1,
                  [
                    [
                      'publisher',
                      0,
                      [1, ['image_url', 'created_at', 'updated_at']]
                    ],
                    [
                      'current_version',
                      1,
                      [
                        1,
                        [
                          'provider_id',
                          'is_current',
                          'specification_id',
                          'created_at',
                          'updated_at'
                        ]
                      ]
                    ],
                    ['oauth', 0, [1, ['callback_url', 'auto_registration']]],
                    'created_at',
                    'updated_at'
                  ]
                ]
              ],
              [
                'deployment',
                0,
                [1, ['is_default', 'provider_id', 'locked_version_id']]
              ],
              ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
              'config_schema',
              [
                'auth_methods',
                1,
                [
                  2,
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
                ]
              ],
              'magic_mcp_server'
            ]
          ]
        ]
      ]
    ],
    1
  );
