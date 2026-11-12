import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId, snowflake } from '@metorial-subspace/db';
import { withUniqueConstraintRecovery } from '@metorial/db';
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

  let groupWhere = {
    type_hash_tenantOid: {
      type: error.type,
      hash,
      tenantOid: error.session.tenantOid
    }
  };

  let group = await db.sessionErrorGroup.findUnique({
    where: groupWhere
  });

  if (!group) {
    group = await withUniqueConstraintRecovery(
      () =>
        db.sessionErrorGroup.upsert({
          where: groupWhere,
          create: {
            ...getId('sessionErrorGroup'),
            type: error.type,
            hash,
            code: error.code,
            message: error.message,
            tenantOid: error.session.tenantOid,
            projectOid: error.session.projectOid,
            environmentOid: error.session.environmentOid,
            instanceOid: error.session.instanceOid,
            providerOid: error.providerRun?.providerOid,
            firstOccurrenceOid: error.oid
          },
          update: {}
        }),
      () => db.sessionErrorGroup.findUnique({ where: groupWhere })
    );
  }

  let dayStart = startOfDay(new Date());
  let periodWhere = {
    groupOid_startsAt: {
      groupOid: group.oid,
      startsAt: dayStart
    }
  };

  await withUniqueConstraintRecovery(
    () =>
      db.sessionErrorGroupOccurrencePeriod.upsert({
        where: periodWhere,
        update: { occurrenceCount: { increment: 1 } },
        create: {
          oid: snowflake.nextId(),
          groupOid: group.oid,
          startsAt: dayStart,
          endsAt: endOfDay(dayStart),
          occurrenceCount: 1
        }
      }),
    async () => {
      try {
        return await db.sessionErrorGroupOccurrencePeriod.update({
          where: periodWhere,
          data: { occurrenceCount: { increment: 1 } }
        });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'P2025') return null;
        throw error;
      }
    }
  );

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
      projectOid: error.projectOid,
      environmentOid: error.environmentOid,
      instanceOid: error.instanceOid,
      solutionOid: error.solutionOid
    }
  });

  await db.sessionError.updateMany({
    where: { id: error.id },
    data: { isProcessing: false, groupOid: group.oid }
  });
});
