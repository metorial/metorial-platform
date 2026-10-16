import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceChatConnectionsGetOutput = {
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

export let mapDashboardInstanceChatConnectionsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceChatConnectionsGetOutput>(
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
