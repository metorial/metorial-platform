import { createMapper } from '@metorial/util-resource-mapper/compact';

export type CallbackInstancesListOutput = {
  items: {
    object: 'callback.instance';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    callbackId: string;
    integrationInstanceId: string;
    integrationInstanceProviderId: string;
    createdAt: Date;
    updatedAt: Date;
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

export let mapCallbackInstancesListOutput =
  /* @__PURE__ */ createMapper<CallbackInstancesListOutput>(
    [
      7,
      [
        1,
        [
          'callback_id',
          'integration_instance_id',
          'integration_instance_provider_id',
          'created_at',
          'updated_at',
          ['sync', 0, [1, ['synced_at']]]
        ]
      ]
    ],
    1
  );

export type CallbackInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  callbackId?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  integrationInstanceId?: string | string[] | undefined;
  integrationInstanceProviderId?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapCallbackInstancesListQuery =
  /* @__PURE__ */ createMapper<CallbackInstancesListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'callback_id',
            'integration_id',
            'integration_instance_id',
            'integration_instance_provider_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
