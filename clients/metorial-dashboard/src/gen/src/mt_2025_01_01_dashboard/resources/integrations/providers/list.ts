import { createMapper } from '@metorial/util-resource-mapper/compact';

export type IntegrationsProvidersListOutput = {
  items: {
    object: 'integration.provider';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    integrationId: string;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    toolFilter:
      | { type: 'allow_all'; ignoreParentFilters: boolean }
      | {
          type: 'filter';
          filters: (
            | { type: 'tool_keys'; keys: string[] }
            | { type: 'tool_regex'; pattern: string }
            | { type: 'resource_regex'; pattern: string }
            | { type: 'resource_uris'; uris: string[] }
            | { type: 'prompt_keys'; keys: string[] }
            | { type: 'prompt_regex'; pattern: string }
          )[];
          ignoreParentFilters: boolean;
        }
      | null;
    providerId: string;
    deploymentId: string;
    authMethodId: string | null;
    authCredentialsId: string | null;
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
    callbacks: {
      object: 'integration.provider.callbacks';
      status: 'enabled' | 'disabled';
      callbackId: string | null;
      callback: {
        object: 'callback';
        id: string;
        status: 'active' | 'archived' | 'deleted';
        name: string;
        description: string | null;
        metadata: Record<string, any> | null;
        integrationId: string;
        integrationProviderId: string;
        provider: {
          object: 'provider#preview';
          id: string;
          name: string;
          description: string | null;
          slug: string;
          createdAt: Date;
          updatedAt: Date;
        };
        createdAt: Date;
        updatedAt: Date;
        authCredentialsIsManaged: boolean;
        sync: {
          object: 'callback.sync';
          status: 'pending' | 'synced' | 'failed';
          error: {
            object: 'callback.sync.error';
            code: string;
            message: string | null;
          } | null;
          syncedAt: Date | null;
        };
      } | null;
    };
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapIntegrationsProvidersListOutput =
  /* @__PURE__ */ createMapper<IntegrationsProvidersListOutput>(
    [
      7,
      [
        1,
        [
          'integration_id',
          ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
          'provider_id',
          'deployment_id',
          'auth_method_id',
          'auth_credentials_id',
          [
            'config',
            0,
            [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
          ],
          [
            'callbacks',
            0,
            [
              1,
              [
                'callback_id',
                [
                  'callback',
                  0,
                  [
                    1,
                    [
                      'integration_id',
                      'integration_provider_id',
                      ['provider', 0, 8],
                      'created_at',
                      'updated_at',
                      'auth_credentials_is_managed',
                      ['sync', 0, [1, ['synced_at']]]
                    ]
                  ]
                ]
              ]
            ]
          ],
          'created_at',
          'updated_at',
          'archived_at',
          ['provider', 0, 8],
          [
            'deployment',
            0,
            [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
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
          ]
        ]
      ]
    ],
    1
  );

export type IntegrationsProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerAuthMethodId?: string | string[] | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapIntegrationsProvidersListQuery =
  /* @__PURE__ */ createMapper<IntegrationsProvidersListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'integration_id',
            'provider_id',
            'provider_deployment_id',
            'provider_auth_method_id',
            'provider_auth_credentials_id',
            'provider_config_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
