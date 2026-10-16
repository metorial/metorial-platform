import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIntegrationsInstancesProvidersListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceIntegrationsInstancesProvidersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationsInstancesProvidersListOutput>(
    [
      7,
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
        ]
      ]
    ],
    1
  );

export type DashboardInstanceIntegrationsInstancesProvidersListQuery = {
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
  integrationInstanceId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  integrationProviderId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  sessionTemplateId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceIntegrationsInstancesProvidersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationsInstancesProvidersListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'integration_id',
              'integration_instance_id',
              'provider_id',
              'integration_provider_id',
              'provider_deployment_id',
              'provider_config_id',
              'provider_auth_config_id',
              'session_template_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
