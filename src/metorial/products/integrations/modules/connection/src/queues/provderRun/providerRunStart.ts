import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, dbPrimary, getId } from '@metorial-subspace/db';
import { v7 } from 'uuid';
import { env } from '../../env';

export let providerRunStartQueue = createQueue<{ providerRunId: string }>({
  name: 'sub/con/p-run/start',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let providerRunStartQueueProcessor = providerRunStartQueue.process(async data => {
  let providerRun = await dbPrimary.providerRun.findUnique({
    where: { id: data.providerRunId }
  });
  if (!providerRun) throw new QueueRetryError();

  await db.providerRunUsageRecord.createMany({
    data: {
      id: v7(),

      providerRunOid: providerRun.oid,
      tenantOid: providerRun.tenantOid,
      projectOid: providerRun.projectOid,
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
      projectOid: providerRun.projectOid,
      solutionOid: providerRun.solutionOid,
      environmentOid: providerRun.environmentOid,
      // ProviderRun.instanceOid is a SessionProviderInstance; the mirrored
      // Metorial instance lives on metorialInstanceOid
      instanceOid: providerRun.metorialInstanceOid
    }
  });
});
