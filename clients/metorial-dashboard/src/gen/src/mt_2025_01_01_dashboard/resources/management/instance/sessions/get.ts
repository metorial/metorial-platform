import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSessionsGetOutput = {
  object: 'session';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  connectionState: 'connected' | 'disconnected';
  connectionUrl: string;
  clientSecret: string | null;
  usage: {
    totalProductiveClientMessageCount: number;
    totalProductiveProviderMessageCount: number;
  };
  providers: {
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
  }[];
  fromTemplateIds: string[];
  hasErrors: boolean;
  hasWarnings: boolean;
  identityActorId: string | null;
  identityId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSessionsGetOutput>(
    [
      'connection_state',
      'connection_url',
      'client_secret',
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
      [
        'providers',
        0,
        [
          2,
          [
            1,
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
            ]
          ]
        ]
      ],
      'from_template_ids',
      'has_errors',
      'has_warnings',
      'identity_actor_id',
      'identity_id',
      'created_at',
      'updated_at'
    ],
    1
  );
