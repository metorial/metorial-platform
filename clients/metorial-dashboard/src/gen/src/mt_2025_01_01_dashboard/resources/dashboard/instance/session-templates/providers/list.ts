import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSessionTemplatesProvidersListOutput = {
  items: {
    object: 'session.template.provider';
    id: string;
    status: 'active' | 'archived' | 'deleted';
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
    sessionTemplateId: string;
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
    };
    authConfig: { object: 'provider.auth_config#preview'; id: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSessionTemplatesProvidersListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSessionTemplatesProvidersListOutput>(
    [
      7,
      [
        1,
        [
          ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
          'provider_id',
          'session_template_id',
          [
            'deployment',
            0,
            [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
          ],
          [
            'config',
            0,
            [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
          ],
          'auth_config',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSessionTemplatesProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  id?: string | string[] | undefined;
  sessionTemplateId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerConfigId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSessionTemplatesProvidersListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSessionTemplatesProvidersListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'session_template_id',
              'provider_id',
              'provider_deployment_id',
              'provider_config_id',
              'provider_auth_config_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
