import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput =
  {
    object: 'provider.auth_export';
    id: string;
    note: string;
    ip: string | null;
    userAgent: string | null;
    metadata: Record<string, any> | null;
    authConfig: {
      object: 'provider.auth_config';
      id: string;
      type: 'manual' | 'oauth_automated' | 'oauth_manual';
      source: 'manual' | 'setup_session' | 'system' | 'explorer';
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
      };
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
            | { id: string; profileId: string; portalId: string | null }
            | undefined;
        } | null;
      };
      createdAt: Date;
      updatedAt: Date;
    };
    providerId: string;
    providerDeploymentId: string | null;
    authMethodId: string;
    credentialsId: string | null;
    value: Record<string, any> | null;
    createdAt: Date;
    expiresAt: Date | null;
  };

export let mapDashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput>(
    [
      'user_agent',
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
          ]
        ]
      ],
      'provider_id',
      'provider_deployment_id',
      'auth_method_id',
      'credentials_id',
      'created_at',
      'expires_at'
    ],
    1
  );

export type DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody = {
  providerAuthConfigId: string;
  note: string;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody>(
    ['provider_auth_config_id']
  );
