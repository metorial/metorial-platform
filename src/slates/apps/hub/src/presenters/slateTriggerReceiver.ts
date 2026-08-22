import {
  SlateTriggerReceiverTriggerSource,
  type Slate,
  type SlateAction,
  type SlateAuthConfig,
  type SlateInstance,
  type SlateTriggerReceiver,
  type SlateTriggerReceiverTrigger
} from '../../prisma/generated/client';
import {
  getReceiverWebhookBaseUrl,
  getTriggerWebhookBaseUrl
} from '../lib/triggerWebhook';

export let slateTriggerReceiverPresenter = (
  receiver: SlateTriggerReceiver & {
    slate: Slate;
    slateInstance: SlateInstance;
    authConfig: SlateAuthConfig | null;
    triggers: (SlateTriggerReceiverTrigger & { action: SlateAction })[];
  }
) => ({
  object: 'slate.trigger.receiver',

  id: receiver.id,
  slateId: receiver.slate.id,
  slateInstanceId: receiver.slateInstance.id,
  authConfigId: receiver.authConfig?.id ?? null,

  status: receiver.status,
  deliveryMode: receiver.deliveryMode,
  callbackId: receiver.callbackId,
  callbackInstanceId: receiver.callbackInstanceId,
  name: receiver.name,
  description: receiver.description,
  eventTypes: receiver.eventTypes,
  consecutivePollingFailures: receiver.consecutivePollingFailures,
  consecutiveEventFailures: receiver.consecutiveEventFailures,
  receiverWebhookUrl: getReceiverWebhookBaseUrl(receiver.id),

  triggers: receiver.triggers.map(trigger => ({
    object: 'slate.trigger.receiver.trigger',

    id: trigger.id,
    triggerId: trigger.action.id,
    triggerKey: trigger.action.key,
    triggerName: trigger.action.name,

    source: trigger.source,
    pollIntervalSeconds: trigger.pollIntervalSeconds,
    nextPollAt: trigger.nextPollAt,
    lastPolledAt: trigger.lastPolledAt,

    webhookUrl:
      trigger.source === SlateTriggerReceiverTriggerSource.webhook
        ? getTriggerWebhookBaseUrl(trigger.id)
        : null,
    isWebhookRegistered:
      trigger.source === SlateTriggerReceiverTriggerSource.webhook
        ? !!trigger.registrationDetails
        : null
  })),

  destinations: [],

  createdAt: receiver.createdAt,
  updatedAt: receiver.updatedAt
});
