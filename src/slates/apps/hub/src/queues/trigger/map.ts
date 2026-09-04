import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { triggerEventServiceInternal } from '../../internal';
import { secretService, slateInvocationService } from '../../services';
import { TRIGGER_EVENT_MAP_MAX_ATTEMPTS, triggerEventMapBackoffMs } from './_config';
import { decrementPendingTriggerMapCount, markRawEventProcessingFailed } from './_rawEvent';
import { triggerRawEventCleanupQueue } from './cleanup';
import { triggerEventProcessQueue } from './eventProcess';

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

export let triggerMapQueue = createQueue<{
  rawEventId: string;
  triggerId: string;
  attempt: number;
}>({
  name: 'shub/trg/evt/mapOne',
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
    triggerId: data.triggerId,
    source: rawEvent.source
  });

  if (registration.status === 'deleted') {
    await triggerEventServiceInternal.resolveFinalFailure({
      eventOid: event.oid,
      attempt: data.attempt,
      errorCode: 'registration_deleted',
      errorMessage: 'Trigger registration was deleted before mapping completed'
    });
    await markRawEventProcessingFailed({ rawEventOid: rawEvent.oid });
    return;
  }

  let version = await getActiveSlateVersion({
    slate: registration.slate,
    instance: registration.instance
  });

  let auth: { authenticationMethodId: string; data: Record<string, any> } | null = null;
  if (registration.authConfig) {
    let decrypted = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: registration.authConfig.secretOid,
      purpose: 'slate_authentication_configuration',
      tenant: registration.tenant,
      note: `trigger-map:${rawEvent.id}:${data.triggerId}`
    });
    auth = {
      authenticationMethodId: registration.authConfig.authMethod.key,
      data: decrypted.output ?? decrypted.input ?? {}
    };
  }

  let stack = await slateInvocationService.createInvocationWithState({
    participants: [],
    slateVersion: version,
    tenant: registration.tenant,
    session: { id: instance.id, state: {} },
    config: registration.instanceConfig.value ?? {},
    auth
  });

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

  await triggerEventServiceInternal.resolveMapped({
    eventOid: event.oid,
    attempt: data.attempt,
    payload: result.data.output,
    mappedType: result.data.type,
    mappedId: result.data.id
  });

  await triggerEventProcessQueue.add({ eventId: event.id });

  let updatedRawEvent = await decrementPendingTriggerMapCount({ rawEventOid: rawEvent.oid });
  if (updatedRawEvent.pendingTriggerMapCount === 0) {
    await triggerRawEventCleanupQueue.add({ rawEventId: rawEvent.id });
  }
});
