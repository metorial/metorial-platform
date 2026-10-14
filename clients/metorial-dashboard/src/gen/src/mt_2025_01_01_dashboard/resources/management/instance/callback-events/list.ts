import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCallbackEventsListOutput = {
  items: {
    object: 'callback_event';
    id: string;
    status: 'pending' | 'processed' | 'failed';
    source: 'webhook' | 'polling';
    providerTriggerKey: string;
    mappedType: string | null;
    mappedId: string | null;
    callbackId: string;
    callbackInstanceId: string;
    occurredAt: Date;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCallbackEventsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceCallbackEventsListOutput>(
    [
      7,
      [
        1,
        [
          'provider_trigger_key',
          'mapped_type',
          'mapped_id',
          'callback_id',
          'callback_instance_id',
          'occurred_at',
          'created_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceCallbackEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  callbackId?: string | string[] | undefined;
  callbackInstanceId?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  integrationProviderId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerTriggerKey?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'processed'
    | 'failed'
    | ('pending' | 'processed' | 'failed')[]
    | undefined;
  source?: 'webhook' | 'polling' | ('webhook' | 'polling')[] | undefined;
  occurredAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceCallbackEventsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceCallbackEventsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'callback_id',
            'callback_instance_id',
            'integration_id',
            'integration_provider_id',
            'provider_id',
            'provider_trigger_key',
            ['occurred_at', 1, 5],
            ['created_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
