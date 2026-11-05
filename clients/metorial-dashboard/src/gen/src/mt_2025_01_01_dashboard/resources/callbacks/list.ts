import { createMapper } from '@metorial/util-resource-mapper/compact';

export type CallbacksListOutput = {
  items: {
    object: 'callback';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    integrationId: string;
    integrationProviderId: string;
    provider: {
      object: 'provider#preview';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
    authCredentialsIsManaged: boolean;
    authCredentialsId: string | null;
    sync: {
      object: 'callback.sync';
      status: 'pending' | 'synced' | 'failed';
      error: {
        object: 'callback.sync.error';
        code: string;
        message: string | null;
      } | null;
      syncedAt: Date | null;
    };
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapCallbacksListOutput =
  /* @__PURE__ */ createMapper<CallbacksListOutput>(
    [
      7,
      [
        1,
        [
          'integration_id',
          'integration_provider_id',
          ['provider', 0, 8],
          'created_at',
          'updated_at',
          'auth_credentials_is_managed',
          'auth_credentials_id',
          ['sync', 0, [1, ['synced_at']]]
        ]
      ]
    ],
    1
  );

export type CallbacksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  integrationProviderId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapCallbacksListQuery =
  /* @__PURE__ */ createMapper<CallbacksListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'integration_id',
            'integration_provider_id',
            'provider_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
