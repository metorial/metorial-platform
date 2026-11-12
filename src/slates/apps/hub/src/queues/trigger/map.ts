import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { triggerEventServiceInternal } from '../../internal/triggerEventServiceInternal';
import { slateInvocationService } from '../../services/slateInvocation';
import { TRIGGER_EVENT_MAP_MAX_ATTEMPTS, triggerEventMapBackoffMs } from './_config';
import { createTriggerInstanceStack } from './_stack';
import { triggerRawEventCleanupQueue } from './cleanup';
import { triggerEventProcessQueue } from './eventProcess';
import {
  triggerEventPayloadOffloadQueue,
  triggerRawEventPayloadOffloadQueue
} from './payloadOffload';

let include = {
  triggerRegistrationInstance: {
    include: {
      triggerGroup: true,
      triggerRegistration: {
        include: {
          tenant: true,
          slate: true,
          instance: true,
          instanceConfig: true,
          authConfig: { include: { authMethod: true } }
        }
      }
    }
  }
};

// A failed raw event keeps its payload until its last trigger settles, whichever way.
let offloadSettledFailedRawEvent = async (rawEvent: { oid: bigint; id: string }) => {
  let pendingChildren = await db.triggerEvent.count({
    where: {
      rawEventOid: rawEvent.oid,
      status: { in: ['pending', 'mapping_failed'] }
    }
  });
  if (pendingChildren > 0) return;

  await triggerRawEventPayloadOffloadQueue.add({ rawEventId: rawEvent.id });
};

let markRawEventProcessingFailed = async (d: { rawEventOid: bigint }) => {
  let updated = await db.triggerRawEvent.update({
    where: { oid: d.rawEventOid },
    data: { processingStatus: 'failed' }
  });

  await offloadSettledFailedRawEvent(updated);
};

export let triggerMapQueue = createQueue<{
  rawEventId: string;
  triggerId: string;
  attempt: number;
}>({
  name: 'shub/trg/evt/mapOne/1',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let triggerMapQueueProcessor = triggerMapQueue.process(async data => {
  let rawEvent = await db.triggerRawEvent.findUnique({
    where: { id: data.rawEventId },
    include
  });
  if (!rawEvent) return;

  let instance = rawEvent.triggerRegistrationInstance;
  let registration = instance.triggerRegistration;

  let event = await triggerEventServiceInternal.upsertPending({
    triggerRegistrationInstanceOid: instance.oid,
    rawEventOid: rawEvent.oid,
    webhookEventOid: rawEvent.webhookEventOid,
    triggerId: data.triggerId,
    source: rawEvent.source
  });

  if (event.status === 'mapping_failed_final') return;
  if (event.status === 'mapped') {
    // The dispatch row is removed once the event is delivered, so a map job retried after
    // that must not deliver it again.
    let dispatch = await db.triggerEventDispatch.findUnique({
      where: { eventOid: event.oid },
      select: { eventOid: true }
    });

    // Same job id as the mapped-event dispatch scanner, so the two cannot deliver twice.
    if (dispatch) await triggerEventProcessQueue.add({ eventId: event.id }, { id: event.id });
    await triggerEventPayloadOffloadQueue.add({ triggerEventId: event.id });
    if (rawEvent.processingStatus === 'failed') await offloadSettledFailedRawEvent(rawEvent);
    if (rawEvent.pendingTriggerMapCount === 0)
      await triggerRawEventCleanupQueue.add({ rawEventId: rawEvent.id });
    return;
  }

  if (registration.status === 'deleted' || registration.tenant.disableCallbacks) {
    await triggerEventServiceInternal.resolveFinalFailure({
      eventOid: event.oid,
      attempt: data.attempt,
      errorCode: 'registration_deleted',
      errorMessage: 'Trigger registration was deleted before mapping completed'
    });
    await markRawEventProcessingFailed({ rawEventOid: rawEvent.oid });
    return;
  }

  let stack = await createTriggerInstanceStack({
    registration,
    sessionId: instance.id,
    note: `trigger-map:${rawEvent.id}:${data.triggerId}`
  });

  if (rawEvent.payload === null) {
    // Invariant: a raw event's payload is only offloaded once every triggerId on it has
    // reached a terminal status, so an in-flight mapping attempt should never see this.
    throw new Error(`Trigger raw event ${rawEvent.id} has no payload to map`);
  }

  let result = await slateInvocationService.mapTriggerEvent({
    stack,
    actionId: data.triggerId,
    input: rawEvent.payload
  });

  if (result.status === 'error') {
    await triggerEventServiceInternal.recordInvocation({
      eventOid: event.oid,
      attempt: data.attempt,
      invocationOid: result.invocation.oid,
      status: 'failed',
      errorCode: result.error.code,
      errorMessage: result.error.message
    });

    let retryable = result.error.retryable ?? true;
    let isFinalAttempt = !retryable || data.attempt >= TRIGGER_EVENT_MAP_MAX_ATTEMPTS;

    if (isFinalAttempt) {
      await triggerEventServiceInternal.resolveFinalFailure({
        eventOid: event.oid,
        attempt: data.attempt,
        errorCode: result.error.code,
        errorMessage: result.error.message
      });
      await markRawEventProcessingFailed({ rawEventOid: rawEvent.oid });
      return;
    }

    await triggerEventServiceInternal.resolveRetryableFailure({
      eventOid: event.oid,
      attempt: data.attempt,
      errorCode: result.error.code,
      errorMessage: result.error.message
    });

    let nextAttempt = data.attempt + 1;
    await triggerMapQueue.add(
      { rawEventId: data.rawEventId, triggerId: data.triggerId, attempt: nextAttempt },
      {
        delay: triggerEventMapBackoffMs(nextAttempt),
        id: `${data.rawEventId}:${data.triggerId}:${nextAttempt}`
      }
    );
    return;
  }

  await triggerEventServiceInternal.recordInvocation({
    eventOid: event.oid,
    attempt: data.attempt,
    invocationOid: result.invocation.oid,
    status: 'succeeded'
  });

  let resolved = await triggerEventServiceInternal.resolveMapped({
    rawEventOid: rawEvent.oid,
    eventOid: event.oid,
    attempt: data.attempt,
    payload: result.data.output,
    mappedType: result.data.type,
    mappedId: result.data.id
  });
  await triggerEventPayloadOffloadQueue.add({ triggerEventId: event.id });

  await triggerEventProcessQueue.add({ eventId: event.id }, { id: event.id });

  if (resolved.rawEvent?.processingStatus === 'failed')
    await offloadSettledFailedRawEvent(resolved.rawEvent);

  if (resolved.rawEvent?.pendingTriggerMapCount === 0) {
    await triggerRawEventCleanupQueue.add({ rawEventId: rawEvent.id });
  }
});
