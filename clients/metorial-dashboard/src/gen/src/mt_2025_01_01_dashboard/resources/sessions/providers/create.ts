import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SessionsProvidersCreateOutput = {
  object: 'session.provider';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  usage: {
    totalProductiveClientMessageCount: number;
    totalProductiveProviderMessageCount: number;
  };
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
  sessionId: string;
  fromTemplateId: string | null;
  fromTemplateProviderId: string | null;
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
};

export let mapSessionsProvidersCreateOutput =
  /* @__PURE__ */ mapObject<SessionsProvidersCreateOutput>(
    [
      [
        'usage',
        0,
        [
          1,
          [
            'total_productive_client_message_count',
            'total_productive_provider_message_count'
          ]
        ]
      ],
      ['tool_filter', 1, [3, [[0, [1, ['ignore_parent_filters']]]]]],
      'provider_id',
      'session_id',
      'from_template_id',
      'from_template_provider_id',
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
    ],
    1
  );

export type SessionsProvidersCreateBody = {
  sessionId: string;
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
} & (
  | (
      | { providerDeploymentId?: string | undefined }
      | {
          providerDeployment?:
            | {
                providerId: string;
                name?: string | undefined;
                description?: string | undefined;
                metadata?: Record<string, any> | undefined;
                lockedProviderVersionId?: string | undefined;
              }
            | undefined;
        }
    )
  | (
      | { providerConfigId?: string | undefined }
      | {
          providerConfig?:
            | { name?: string | undefined; value: Record<string, any> }
            | {
                name?: string | undefined;
                providerConfigVaultId: string;
                providerId?: string | undefined;
              }
            | undefined;
        }
    )
  | (
      | { providerAuthConfigId?: string | undefined }
      | {
          providerAuthConfig?:
            | {
                name?: string | undefined;
                providerAuthMethodId: string;
                credentials: Record<string, any>;
                providerId?: string | undefined;
              }
            | undefined;
        }
    )
);

export let mapSessionsProvidersCreateBody =
  /* @__PURE__ */ createMapper<SessionsProvidersCreateBody>([
    3,
    [
      [
        0,
        [
          1,
          [
            'session_id',
            'tool_filters',
            'provider_deployment_id',
            [
              'provider_deployment',
              1,
              [1, ['provider_id', 'locked_provider_version_id']]
            ],
            'provider_config_id',
            [
              'provider_config',
              1,
              [3, [[0, [1, ['provider_config_vault_id', 'provider_id']]]]]
            ],
            'provider_auth_config_id',
            [
              'provider_auth_config',
              1,
              [1, ['provider_auth_method_id', 'provider_id']]
            ]
          ]
        ]
      ]
    ]
  ]);
