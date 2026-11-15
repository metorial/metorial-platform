import { db } from '@metorial-subspace/db';
import { createQueue } from '@metorial/queue';
import { buildSessionUsageEvent } from '../lib/events';
import {
  resolveUsageConsumerContextByActor,
  resolveUsageInstance,
  resolveUsageSessionDims
} from '../lib/subspace';
import { usageService } from '../services';

export let usageRecordSessionQueue = createQueue<{ sessionId: string }>({
  name: 'usage/record/session',
  workerOpts: { concurrency: 5, limiter: { max: 50, duration: 1000 } }
});

export let usageRecordSessionProcessor = usageRecordSessionQueue.process(async data => {
  let session = await db.session.findUnique({
    where: { id: data.sessionId },
    select: {
      oid: true,
      id: true,
      isInternal: true,
      instanceOid: true,
      identityActorOid: true,
      createdAt: true,
      providers: { select: { provider: { select: { id: true } } } }
    }
  });
  if (!session || session.isInternal) return;

  let instance = await resolveUsageInstance(session.instanceOid);
  if (!instance) return;

  let [sessionDims, consumer] = await Promise.all([
    resolveUsageSessionDims(session),
    resolveUsageConsumerContextByActor(session.identityActorOid)
  ]);

  await usageService.record(
    buildSessionUsageEvent(
      {
        createdAt: session.createdAt,
        providerIds: session.providers.map(provider => provider.provider.id)
      },
      { instance, session: sessionDims, ...consumer }
    )
  );
});
