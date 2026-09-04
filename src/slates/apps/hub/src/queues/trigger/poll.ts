import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { addSeconds, min } from 'date-fns';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { secretService, slateInvocationService } from '../../services';
import { TRIGGER_POLL_MAX_FAILURE_BACKOFF_SECONDS, triggerPollWorkerOpts } from './_config';
import { triggerRawEventMappingQueue } from './rawEventMapping';

let pollLock = createLock({
  name: 'shub/trg/poll/lock',
  redisUrl: env.service.REDIS_URL
});

let include = {
  triggerRegistrationInstance: {
    include: {
      triggerGroup: true,
      triggerRegistration: {
        include: {
          tenant: true,
          slate: true,
          instanceConfig: true,
          authConfig: { include: { authMethod: true } }
        }
      }
    }
  }
};

export let triggerPollQueue = createQueue<{ scheduleId: string }>({
  name: 'shub/trg/poll',
  redisUrl: env.service.REDIS_URL,
  workerOpts: triggerPollWorkerOpts
});

export let triggerPollQueueProcessor = triggerPollQueue.process(async data =>
  pollLock.usingLock(data.scheduleId, () => processScheduledPoll(data.scheduleId))
);

let processScheduledPoll = async (scheduleId: string) => {
  let schedule = await db.triggerRegistrationSchedule.findUnique({
    where: { id: scheduleId },
    include
  });
  if (!schedule) return;

  let instance = schedule.triggerRegistrationInstance;
  let registration = instance.triggerRegistration;

  if (schedule.isDisabled || registration.status === 'deleted') {
    await db.triggerRegistrationSchedule.update({
      where: { oid: schedule.oid },
      data: { isDisabled: true, claimedUntil: null }
    });
    return;
  }

  let version = await getActiveSlateVersion({ slate: registration.slate });

  let auth: { authenticationMethodId: string; data: Record<string, any> } | null = null;
  if (registration.authConfig) {
    let decrypted = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: registration.authConfig.secretOid,
      purpose: 'slate_authentication_configuration',
      tenant: registration.tenant,
      note: `trigger-poll:${schedule.id}`
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

  let result = await slateInvocationService.pollTriggerGroup({
    stack,
    triggerGroupId: instance.triggerGroup.key,
    state: null
  });

  await db.triggerPollingRun.create({
    data: {
      ...getId('triggerPollingRun'),
      status: result.status === 'success' ? 'succeeded' : 'failed',
      scheduleOid: schedule.oid,
      invocationOid: result.invocation.oid,
      errorCode: result.status === 'error' ? result.error.code : null,
      errorMessage: result.status === 'error' ? result.error.message : null
    }
  });

  if (result.status === 'success' && result.data.events.length > 0) {
    let rows = result.data.events.map(event => ({
      ...getId('triggerRawEvent'),
      source: 'polling' as const,
      triggerRegistrationInstanceOid: instance.oid,
      payload: event.payload,
      idempotencyKey: event.idempotencyKey ?? null,
      triggerIds: event.triggerIds,
      matchers: Prisma.DbNull
    }));
    await db.triggerRawEvent.createMany({ skipDuplicates: true, data: rows });
    await triggerRawEventMappingQueue.addMany(rows.map(row => ({ rawEventId: row.id })));
  }

  let now = new Date();
  let nextRunAt =
    result.status === 'success'
      ? addSeconds(now, schedule.intervalSeconds)
      : min([
          addSeconds(now, schedule.intervalSeconds),
          addSeconds(now, TRIGGER_POLL_MAX_FAILURE_BACKOFF_SECONDS)
        ]);

  await db.triggerRegistrationSchedule.update({
    where: { oid: schedule.oid },
    data: {
      firstRunAt: schedule.firstRunAt ?? now,
      lastRunAt: now,
      nextRunAt,
      claimedUntil: null
    }
  });
};
