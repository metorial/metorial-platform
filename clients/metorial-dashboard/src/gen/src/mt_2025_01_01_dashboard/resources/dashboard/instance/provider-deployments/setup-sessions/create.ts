import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput = {
  object: 'provider.setup_session';
  id: string;
  type: 'auth_only' | 'config_only' | 'auth_and_config';
  status:
    | 'failed'
    | 'archived'
    | 'deleted'
    | 'pending'
    | 'completed'
    | 'expired';
  url: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  configuration: Record<string, any> | null;
  providerId: string | null;
  identityId: string | null;
  identityCredentialId: string | null;
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
  authConfig: {
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
    createdAt: Date;
    updatedAt: Date;
  } | null;
  config: {
    object: 'provider.config';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    isDefault: boolean;
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
    providerId: string;
    specificationId: string;
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
    fromVault: {
      object: 'provider.config_vault';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
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
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  uiMode: 'metorial_elements' | 'dashboard_embeddable';
  redirectUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export let mapDashboardInstanceProviderDeploymentsSetupSessionsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput>(
    [
      'provider_id',
      'identity_id',
      'identity_credential_id',
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
        'auth_config',
        1,
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
            ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
            'provider_id',
            'specification_id',
            [
              'deployment',
              0,
              [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
            ],
            [
              'from_vault',
              1,
              [
                1,
                [
                  'provider_id',
                  [
                    'deployment',
                    0,
                    [
                      1,
                      ['is_default', 'provider_id', 'created_at', 'updated_at']
                    ]
                  ],
                  'created_at',
                  'updated_at'
                ]
              ]
            ],
            'created_at',
            'updated_at'
          ]
        ]
      ],
      'ui_mode',
      'redirect_url',
      'created_at',
      'updated_at',
      'expires_at'
    ],
    1
  );

export type DashboardInstanceProviderDeploymentsSetupSessionsCreateBody = {
  providerId?: string | undefined;
  providerDeploymentId?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providerAuthMethodId?: string | undefined;
  providerAuthCredentialsId?: string | undefined;
  identityId?: string | undefined;
  consumerId?: string | undefined;
  redirectUrl?: string | undefined;
  type?: 'auth_only' | 'config_only' | 'auth_and_config' | 'auto' | undefined;
  configuration?:
    | {
        providerSearch?:
          | {
              groups?: { groupId: string }[] | undefined;
              collections?: { collectionId: string }[] | undefined;
              categories?: { categoryId: string }[] | undefined;
            }
          | undefined;
        toolFilters?: { enabled?: boolean | undefined } | undefined;
        ui?: { layout?: 'box' | 'side' | 'light' | undefined } | undefined;
      }
    | undefined;
};

export let mapDashboardInstanceProviderDeploymentsSetupSessionsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsSetupSessionsCreateBody>(
    [
      'provider_id',
      'provider_deployment_id',
      'provider_auth_method_id',
      'provider_auth_credentials_id',
      'identity_id',
      'consumer_id',
      'redirect_url',
      [
        'configuration',
        0,
        [
          1,
          [
            [
              'provider_search',
              1,
              [
                1,
                [
                  ['groups', 0, [2, [1, ['group_id']]]],
                  ['collections', 0, [2, [1, ['collection_id']]]],
                  ['categories', 0, [2, [1, ['category_id']]]]
                ]
              ]
            ],
            'tool_filters'
          ]
        ]
      ]
    ]
  );
