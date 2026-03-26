import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { v7 } from 'uuid';
import { env } from '../../env';

export let providerRunStartQueue = createQueue<{ providerRunId: string }>({
  name: 'sub/con/p-run/start',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let providerRunStartQueueProcessor = providerRunStartQueue.process(async data => {
  let providerRun = await db.providerRun.findFirst({
    where: { id: data.providerRunId },
    include: { session: true }
  });
  if (!providerRun) return;

  await db.providerRunUsageRecord.createMany({
    data: {
      id: v7(),

      providerRunOid: providerRun.oid,
      tenantOid: providerRun.tenantOid,
      solutionOid: providerRun.solutionOid
    }
  });

  await db.sessionEvent.createMany({
    data: {
      ...getId('sessionEvent'),
      type: 'provider_run_started',
      providerRunOid: providerRun.oid,

      sessionOid: providerRun.sessionOid,
      connectionOid: providerRun.connectionOid,

      tenantOid: providerRun.tenantOid,
      solutionOid: providerRun.solutionOid,
      environmentOid: providerRun.environmentOid
    }
  });
});
