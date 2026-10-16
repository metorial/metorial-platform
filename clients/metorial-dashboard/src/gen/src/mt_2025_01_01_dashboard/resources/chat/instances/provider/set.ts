import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ChatInstancesProviderSetOutput = {
  object: 'chat.instance_provider';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  chatInstanceId: string;
  chatConnectionProviderId: string;
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
  name: string;
  description: string | null;
  identity: {
    id: string;
    userId: string;
    name: string;
    username: string;
    providerType: string;
    email: string | null;
    imageUrl: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapChatInstancesProviderSetOutput =
  /* @__PURE__ */ mapObject<ChatInstancesProviderSetOutput>(
    [
      'chat_instance_id',
      'chat_connection_provider_id',
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
      [
        'auth_config',
        1,
        [1, ['is_default', 'provider_id', 'created_at', 'updated_at']]
      ],
      ['identity', 0, [1, ['user_id', 'provider_type', 'image_url']]],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ChatInstancesProviderSetBody = {
  providerId: string;
  providerDeploymentId?: string | undefined;
  providerConfigId?: string | null | undefined;
  providerAuthConfigId?: string | null | undefined;
};

export let mapChatInstancesProviderSetBody =
  /* @__PURE__ */ mapObject<ChatInstancesProviderSetBody>([
    'provider_id',
    'provider_deployment_id',
    'provider_config_id',
    'provider_auth_config_id'
  ]);
