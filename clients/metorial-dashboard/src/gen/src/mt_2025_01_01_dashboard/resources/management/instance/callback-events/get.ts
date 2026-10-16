import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCallbackEventsGetOutput = {
  object: 'callback_event';
  id: string;
  status: 'pending' | 'processed' | 'failed';
  source: 'webhook' | 'polling';
  providerTriggerKey: string;
  mappedType: string | null;
  mappedId: string | null;
  callbackId: string;
  callbackInstanceId: string;
  details: {
    object: 'callback_event.details';
    status: string;
    payload: Record<string, any> | null;
    error: {
      object: 'callback_event.details.error';
      code: string;
      message: string;
    } | null;
    webhook: {
      object: 'callback_event.details.webhook';
      id: string;
      status: string;
      request: {
        object: 'callback_event.details.webhook.request';
        method: string;
        url: string;
        headers: Record<string, string>;
        body: { encoding: 'base64'; content: string } | null;
      } | null;
      receivedAt: Date;
    } | null;
  } | null;
  occurredAt: Date;
  createdAt: Date;
};

export let mapManagementInstanceCallbackEventsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceCallbackEventsGetOutput>(
    [
      'provider_trigger_key',
      'mapped_type',
      'mapped_id',
      'callback_id',
      'callback_instance_id',
      ['details', 0, [1, [['webhook', 0, [1, ['received_at']]]]]],
      'occurred_at',
      'created_at'
    ],
    1
  );
