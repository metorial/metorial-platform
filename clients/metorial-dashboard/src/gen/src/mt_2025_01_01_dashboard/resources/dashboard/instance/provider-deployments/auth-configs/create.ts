import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput = {
  object: 'provider.auth_config';
  id: string;
  type: 'manual' | 'oauth_automated' | 'oauth_manual';
  source: 'manual' | 'setup_session' | 'system';
  status: 'active' | 'archived' | 'deleted';
  isDefault: boolean;
  providerId: string;
  name: string | null;
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
  } | null;
  credentials: {
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
  };
  ownerActor: {
    id: string;
    type: 'person' | 'agent' | 'consumer';
    name: string | null;
    imageUrl: string | null;
    consumerId: string | null;
    consumerProfileId: string | null;
    portalId: string | null;
  } | null;
  isOwnerLocked: boolean;
  isOwnerOnlyVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
} & { publicMcpServerId: string | null };

export let mapDashboardInstanceProviderDeploymentsAuthConfigsCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'is_default',
              'provider_id',
              ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
              [
                'deployment',
                0,
                [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
              ],
              [
                'credentials',
                0,
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
                'owner_actor',
                1,
                [
                  1,
                  [
                    'image_url',
                    'consumer_id',
                    'consumer_profile_id',
                    'portal_id'
                  ]
                ]
              ],
              'is_owner_locked',
              'is_owner_only_visible',
              'created_at',
              'updated_at',
              'public_mcp_server_id'
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceProviderDeploymentsAuthConfigsCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
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
  ownedByCaller?: boolean | undefined;
  isOwnerLocked?: boolean | undefined;
  providerAuthMethodId: string;
  providerDeploymentId?: string | undefined;
  value: Record<string, any>;
};

export let mapDashboardInstanceProviderDeploymentsAuthConfigsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthConfigsCreateBody>(
    [
      'tool_filters',
      'owned_by_caller',
      'is_owner_locked',
      'provider_auth_method_id',
      'provider_deployment_id'
    ]
  );
