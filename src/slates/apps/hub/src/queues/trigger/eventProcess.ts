import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getSubspaceClient } from '../../subspace';
import { TRIGGER_EVENT_DELIVER_MAX_ATTEMPTS } from './_config';

let include = {
  triggerRegistrationInstance: {
    include: {
      triggerGroup: true,
      triggerRegistration: {
        include: {
          tenant: true,
          callbackInstance: { include: { callback: true } }
        }
      }
    }
  },
  rawEvent: { select: { webhookEvent: { select: { id: true } } } }
};

export let triggerEventProcessQueue = createQueue<{ eventId: string }>({
  name: 'shub/trg/evt/process/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { attempts: TRIGGER_EVENT_DELIVER_MAX_ATTEMPTS }
});

export let triggerEventProcessQueueProcessor = triggerEventProcessQueue.process(async data => {
  let subspace = getSubspaceClient();
  if (!subspace) {
    console.log(
      `[Trigger] SUBSPACE_INTERNAL_URL is not set - dropping trigger event ${data.eventId}`
    );
    return;
  }

  let event = await db.triggerEvent.findUnique({ where: { id: data.eventId }, include });
  if (!event) return;

  let instance = event.triggerRegistrationInstance;
  let registration = instance.triggerRegistration;
  let callbackInstance = registration.callbackInstance;

  // A trigger registration created outside of a callback has no consumer to deliver to.
  if (!callbackInstance) return;

  await subspace.callbackEvent.receive({
    tenantIdentifier: registration.tenant.identifier,
    callbackId: callbackInstance.callback.id,
    callbackInstanceId: callbackInstance.id,
    triggerEventId: event.id,
    triggerRegistrationId: registration.id,
    triggerGroupKey: instance.triggerGroup.key,
    triggerKey: event.triggerId,
    source: event.source,
    webhookEventId: event.rawEvent?.webhookEvent?.id ?? undefined,
    mappedType: event.mappedType ?? undefined,
    mappedId: event.mappedId ?? undefined,
    occurredAt: event.createdAt
  });
});
