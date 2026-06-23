import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId, snowflake } from '@metorial-subspace/db';
import { endOfDay, startOfDay } from 'date-fns';
import { env } from '../../env';

export let createErrorQueue = createQueue<{ errorId: string }>({
  name: 'sub/con/error/create',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let createErrorQueueProcessor = createErrorQueue.process(async data => {
  let error = await db.sessionError.findFirst({
    where: { id: data.errorId },
    include: { session: true, providerRun: true, connection: true }
  });
  if (!error) throw new QueueRetryError();

  let hash = await Hash.sha256(
    canonicalize([
      error.type,
      String(error.providerRunOid ?? 'null'),
      String(error.session.tenantOid),
      error.code,
      error.message
    ])
  );

  if (!error.session.hasErrors) {
    await db.session.updateMany({
      where: { oid: error.sessionOid },
      data: { hasErrors: true }
    });
  }

  if (error.connection && !error.connection.hasErrors) {
    await db.sessionConnection.updateMany({
      where: { oid: error.connection.oid },
      data: { hasErrors: true }
    });
  }

  let group = await db.sessionErrorGroup.findUnique({
    where: {
      type_hash_tenantOid: {
        type: error.type,
        hash,
        tenantOid: error.session.tenantOid
      }
    }
  });

  if (!group) {
    group = await db.sessionErrorGroup.upsert({
      where: {
        type_hash_tenantOid: {
          type: error.type,
          hash,
          tenantOid: error.session.tenantOid
        }
      },
      create: {
        ...getId('sessionErrorGroup'),
        type: error.type,
        hash,
        code: error.code,
        message: error.message,
        tenantOid: error.session.tenantOid,
        environmentOid: error.session.environmentOid,
        providerOid: error.providerRun?.providerOid,
        firstOccurrenceOid: error.oid
      },
      update: {}
    });
  }

  let dayStart = startOfDay(new Date());

  await db.sessionErrorGroupOccurrencePeriod.upsert({
    where: {
      groupOid_startsAt: {
        groupOid: group.oid,
        startsAt: dayStart
      }
    },
    update: { occurrenceCount: { increment: 1 } },
    create: {
      oid: snowflake.nextId(),
      groupOid: group.oid,
      startsAt: dayStart,
      endsAt: endOfDay(dayStart),
      occurrenceCount: 1
    }
  });

  await db.sessionErrorGroup.updateMany({
    where: { oid: group.oid },
    data: { occurrenceCount: { increment: 1 } }
  });

  await db.sessionEvent.createMany({
    data: {
      ...getId('sessionEvent'),
      type: 'error_occurred',
      sessionOid: error.sessionOid,
      connectionOid: error.connectionOid,
      providerRunOid: error.providerRunOid,
      errorOid: error.oid,
      tenantOid: error.tenantOid,
      environmentOid: error.environmentOid,
      solutionOid: error.solutionOid
    }
  });

  await db.sessionError.updateMany({
    where: { id: error.id },
    data: { isProcessing: false, groupOid: group.oid }
  });
});
