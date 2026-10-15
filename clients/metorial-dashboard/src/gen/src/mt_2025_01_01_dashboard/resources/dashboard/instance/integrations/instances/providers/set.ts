import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIntegrationsInstancesProvidersSetOutput = {
  object: 'integration.instance.provider';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  integrationId: string;
  integrationInstanceId: string;
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
  isOverrideToolFilter: boolean;
  provider: {
    object: 'provider#preview';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  };
  integrationProvider: {
    object: 'integration.provider#snapshot';
    id: string;
    providerVersion: {
      object: 'integration.provider.version';
      id: string;
      index: number;
    };
    status: 'active' | 'archived' | 'deleted';
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
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  };
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
  callbackInstanceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapDashboardInstanceIntegrationsInstancesProvidersSetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceIntegrationsInstancesProvidersSetOutput>(
    [
      'integration_id',
      'integration_instance_id',
      ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
      'is_override_tool_filter',
      ['provider', 0, 8],
      [
        'integration_provider',
        1,
        [
          1,
          [
            'provider_version',
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
            'created_at',
            'updated_at',
            'archived_at'
          ]
        ]
      ],
      [
        'config',
        0,
        [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
      ],
      [
        'auth_config',
        1,
        [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
      ],
      'callback_instance_id',
      'created_at',
      'updated_at',
      'archived_at'
    ],
    1
  );

export type DashboardInstanceIntegrationsInstancesProvidersSetBody = {
  providerDeploymentId?: string | undefined;
  providerConfigId?: string | null | undefined;
  providerAuthConfigId?: string | null | undefined;
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
  isOverrideToolFilter?: boolean | undefined;
};

export let mapDashboardInstanceIntegrationsInstancesProvidersSetBody =
  /* @__PURE__ */ mapObject<DashboardInstanceIntegrationsInstancesProvidersSetBody>(
    [
      'provider_deployment_id',
      'provider_config_id',
      'provider_auth_config_id',
      'tool_filters',
      'is_override_tool_filter'
    ]
  );
