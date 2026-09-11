import { db, snowflake } from '@metorial-subspace/db';
import type { CallbackEventRecorder } from '@metorial-subspace/provider-utils';

export interface SlatesCallbackEventReceiveParam {
  tenantIdentifier: string;
  callbackId: string;
  callbackInstanceId: string;
  triggerEventId: string;
  triggerRegistrationId: string;
  triggerGroupKey: string;
  triggerKey: string;
  source: 'webhook' | 'polling';
  webhookEventId?: string;
  mappedType?: string;
  mappedId?: string;
  occurredAt: Date;
}

export let receiveSlatesCallbackEvent = async (
  input: SlatesCallbackEventReceiveParam,
  ports: { recordEvent: CallbackEventRecorder }
) => {
  let existing = await db.slateTriggerEvent.findUnique({
    where: { id: input.triggerEventId },
    select: { oid: true }
  });
  if (existing) return { received: true };

  let slateCallbackInstance = await db.slateCallbackInstance.findUnique({
    where: { id: input.callbackInstanceId },
    include: { callbackInstance: true, tenant: true }
  });

  // Slates retries on failure, so an event for something we don't track is dropped rather than
  // thrown - it would never succeed.
  if (
    !slateCallbackInstance?.callbackInstance ||
    slateCallbackInstance.callbackInstance.status !== 'active'
  ) {
    console.warn(
      `[Callbacks] Dropping slates trigger event ${input.triggerEventId}: no callback instance for ${input.callbackInstanceId}`
    );
    return { received: false };
  }

  if (slateCallbackInstance.tenant.identifier !== input.tenantIdentifier) {
    console.warn(
      `[Callbacks] Dropping slates trigger event ${input.triggerEventId}: tenant mismatch for ${input.callbackInstanceId}`
    );
    return { received: false };
  }

  let callbackEvent = await ports.recordEvent({
    callbackInstance: slateCallbackInstance.callbackInstance,
    source: input.source,
    providerTriggerKey: input.triggerKey,
    mappedType: input.mappedType,
    mappedId: input.mappedId,
    occurredAt: input.occurredAt
  });

  await db.slateTriggerEvent.create({
    data: {
      oid: snowflake.nextId(),
      id: input.triggerEventId,

      triggerId: input.triggerKey,
      slateWebhookEventId: input.webhookEventId,

      slateCallbackInstanceOid: slateCallbackInstance.oid,
      callbackEventOid: callbackEvent.oid
    }
  });

  return { received: true };
};
