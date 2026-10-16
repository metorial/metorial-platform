import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ChatConnectionsCreateOutput = {
  object: 'chat.connection';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  slug: string;
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  providers: {
    object: 'chat.connection_provider';
    id: string;
    status: 'active' | 'archived' | 'deleted';
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
    } | null;
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
    authMethodId: string | null;
    authCredentialsId: string | null;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    authCredentialsIsManaged: boolean;
    manualWebhookTriggerGroups: {
      key: string;
      name: string;
      description: string | null;
    }[];
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapChatConnectionsCreateOutput =
  /* @__PURE__ */ mapObject<ChatConnectionsCreateOutput>(
    [
      [
        'providers',
        0,
        [
          2,
          [
            1,
            [
              ['provider', 0, 8],
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
              'auth_method_id',
              'auth_credentials_id',
              'created_at',
              'updated_at',
              'auth_credentials_is_managed',
              'manual_webhook_trigger_groups'
            ]
          ]
        ]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ChatConnectionsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  privateMetadata?: Record<string, any> | undefined;
  provider: {
    providerId: string;
    providerDeploymentId?: string | undefined;
    providerAuthMethodId?: string | null | undefined;
    providerAuthCredentialsId?: string | null | undefined;
    providerConfigId?: string | null | undefined;
    name?: string | undefined;
    description?: string | undefined;
    metadata?: Record<string, any> | undefined;
  };
};

export let mapChatConnectionsCreateBody =
  /* @__PURE__ */ mapObject<ChatConnectionsCreateBody>([
    'private_metadata',
    [
      'provider',
      0,
      [
        1,
        [
          'provider_id',
          'provider_deployment_id',
          'provider_auth_method_id',
          'provider_auth_credentials_id',
          'provider_config_id'
        ]
      ]
    ]
  ]);
