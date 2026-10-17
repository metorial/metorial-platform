import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderDeploymentsAuthConfigsListOutput = {
  items: {
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
      consumerId: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProviderDeploymentsAuthConfigsListOutput =
  /* @__PURE__ */ createMapper<ProviderDeploymentsAuthConfigsListOutput>(
    [
      7,
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
          ['owner_actor', 1, [1, ['consumer_id']]],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ProviderDeploymentsAuthConfigsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  availableForUse?: boolean | undefined;
  availableForProviderDeploymentId?: string | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  providerAuthMethodId?: string | string[] | undefined;
  actorId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  identityId?: string | string[] | undefined;
  identityCredentialId?: string | string[] | undefined;
  adapter?: string | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapProviderDeploymentsAuthConfigsListQuery =
  /* @__PURE__ */ createMapper<ProviderDeploymentsAuthConfigsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'provider_id',
            'provider_deployment_id',
            'available_for_use',
            'available_for_provider_deployment_id',
            'provider_auth_credentials_id',
            'provider_auth_method_id',
            'actor_id',
            'consumer_id',
            'identity_id',
            'identity_credential_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
