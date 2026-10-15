import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput = {
  object: 'integration.instance.group.provider';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  integrationId: string;
  integrationInstanceGroupId: string;
  integrationInstanceId: string;
  integrationProviderId: string | null;
  integrationInstanceProviderId: string;
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
  } | null;
  integrationInstanceProvider: {
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
};

export let mapDashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput>(
    [
      'integration_id',
      'integration_instance_group_id',
      'integration_instance_id',
      'integration_provider_id',
      'integration_instance_provider_id',
      ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
      'is_override_tool_filter',
      'created_at',
      'updated_at',
      'archived_at',
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
        'integration_instance_provider',
        1,
        [
          1,
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
                  [
                    'tool_filter',
                    1,
                    [3, [[0, [1, ['ignore_parent_filters']]]]]
                  ],
                  'provider_id',
                  'deployment_id',
                  'auth_method_id',
                  'auth_credentials_id',
                  [
                    'config',
                    0,
                    [
                      1,
                      ['is_default', 'provider_id', 'created_at', 'updated_at']
                    ]
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
          ]
        ]
      ]
    ],
    1
  );
