import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsListOutput = {
  items: {
    object: 'provider.deployment';
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
    lockedVersion: {
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
    defaultConfig: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderDeploymentsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsListOutput>(
    [
      7,
      [
        1,
        [
          'is_default',
          ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
          'provider_id',
          [
            'locked_version',
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
          [
            'default_config',
            1,
            [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
          ],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceProviderDeploymentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerVersionId?: string | string[] | undefined;
  actorId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  identityId?: string | string[] | undefined;
  identityCredentialId?: string | string[] | undefined;
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  capabilities?:
    | {
        supportsConfig?: boolean | undefined;
        supportsAuth?: boolean | undefined;
        supportsOauth?: boolean | undefined;
        supportsCallbacks?: boolean | undefined;
        supportsWebhookRegistration?: boolean | undefined;
        supportsOauthAutoRegistration?: boolean | undefined;
        supportsAuthExport?: boolean | undefined;
        supportsAuthImport?: boolean | undefined;
      }
    | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceProviderDeploymentsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'provider_id',
            'provider_version_id',
            'actor_id',
            'consumer_id',
            'identity_id',
            'identity_credential_id',
            [
              'capabilities',
              0,
              [
                1,
                [
                  ['supportsOAuth', 'supportsOauth'],
                  [
                    'supportsOAuthAutoRegistration',
                    'supportsOauthAutoRegistration'
                  ]
                ]
              ]
            ],
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
