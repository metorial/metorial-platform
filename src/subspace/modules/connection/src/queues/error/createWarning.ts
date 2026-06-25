import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';

export let createWarningQueue = createQueue<{ warningId: string }>({
  name: 'sub/con/warning/create',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let createWarningQueueProcessor = createWarningQueue.process(async data => {
  let warning = await db.sessionWarning.findFirst({
    where: { id: data.warningId },
    include: { session: true, connection: true }
  });
  if (!warning) throw new QueueRetryError();

  if (!warning.session.hasErrors) {
    await db.session.updateMany({
      where: { oid: warning.sessionOid },
      data: { hasErrors: true }
    });
  }

  if (warning.connection && !warning.connection.hasErrors) {
    await db.sessionConnection.updateMany({
      where: { oid: warning.connection.oid },
      data: { hasErrors: true }
    });
  }

  await db.sessionEvent.createMany({
    data: {
      ...getId('sessionEvent'),
      type: 'warning_occurred',
      sessionOid: warning.sessionOid,
      warningOid: warning.oid,
      tenantOid: warning.tenantOid,
      environmentOid: warning.environmentOid,
      solutionOid: warning.solutionOid
    }
  });
});
