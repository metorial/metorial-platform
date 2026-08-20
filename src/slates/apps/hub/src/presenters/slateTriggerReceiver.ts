import {
  SlateTriggerReceiverTriggerSource,
  type Slate,
  type SlateAction,
  type SlateAuthConfig,
  type SlateInstance,
  type SlateTriggerReceiver,
  type SlateTriggerReceiverTrigger
} from '../../prisma/generated/client';
import { getReceiverWebhookBaseUrl, getTriggerWebhookBaseUrl } from '../lib/triggerWebhook';

let safeLifecycleMetadata = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  let record = value as Record<string, unknown>;
  return {
    ...(typeof record.version === 'number' ? { version: record.version } : {}),
    ...(typeof record.operation === 'string' ? { operation: record.operation } : {}),
    ...(typeof record.attempt === 'number' ? { attempt: record.attempt } : {})
  };
};

export let slateTriggerReceiverPresenter = (
  receiver: SlateTriggerReceiver & {
    slate: Slate;
    slateInstance: SlateInstance;
    authConfig: SlateAuthConfig | null;
    triggers: (SlateTriggerReceiverTrigger & { action: SlateAction })[];
    pathSecrets?: Array<{
      id: string;
      status: string;
      secretVersion: number;
      validFrom: Date;
      validUntil: Date | null;
      rotatedAt: Date | null;
    }>;
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
  callbackOwnerVersion: receiver.callbackOwnerVersion,
  name: receiver.name,
  description: receiver.description,
  eventTypes: receiver.eventTypes,
  consecutivePollingFailures: receiver.consecutivePollingFailures,
  consecutiveEventFailures: receiver.consecutiveEventFailures,
  receiverWebhookUrl: getReceiverWebhookBaseUrl(receiver.id),
  receiverPathSecrets: (receiver.pathSecrets ?? [])
    // Match verification semantics: a retiring secret past its grace window is
    // no longer accepted, so it must not surface in the read model either.
    .filter(
      secret =>
        secret.status !== 'retiring' ||
        (secret.validUntil !== null && secret.validUntil > new Date())
    )
    .map(secret => ({
      id: secret.id,
      status: secret.status,
      secretVersion: secret.secretVersion,
      validFrom: secret.validFrom,
      validUntil: secret.validUntil,
      rotatedAt: secret.rotatedAt
    })),

  triggers: receiver.triggers.map(trigger => ({
    object: 'slate.trigger.receiver.trigger',

    id: trigger.id,
    active: trigger.tombstonedAt === null,
    authoritativeStateVersion: trigger.authoritativeStateVersion,
    triggerId: trigger.action.id,
    triggerKey: trigger.action.key,
    triggerName: trigger.action.name,

    source: trigger.source,
    eventTypes: trigger.eventTypes,
    pollIntervalSeconds: trigger.pollIntervalSeconds,
    nextPollAt: trigger.nextPollAt,
    lastPolledAt: trigger.lastPolledAt,

    webhookUrl:
      trigger.source === SlateTriggerReceiverTriggerSource.webhook
        ? getTriggerWebhookBaseUrl(trigger.id)
        : null,
    registrationStatus: trigger.registrationStatus,
    registrationGeneration: trigger.registrationGeneration,
    registrationTransitionVersion: trigger.registrationTransitionVersion,
    registrationError: trigger.registrationErrorCode
      ? {
          code: trigger.registrationErrorCode,
          message: trigger.registrationErrorMessage,
          metadata: safeLifecycleMetadata(trigger.registrationErrorMetadata),
          at: trigger.registrationErrorAt
        }
      : null,
    verificationMechanism: trigger.verificationMechanism,
    verificationSpecHash: trigger.verificationSpecHash,
    isWebhookRegistered:
      trigger.source === SlateTriggerReceiverTriggerSource.webhook
        ? trigger.registrationStatus === 'registered'
        : null
  })),

  destinations: [],

  createdAt: receiver.createdAt,
  updatedAt: receiver.updatedAt
});
