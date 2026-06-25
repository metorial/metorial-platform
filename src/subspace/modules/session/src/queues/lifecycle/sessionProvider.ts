import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';

export let sessionProviderCreatedQueue = createQueue<{ sessionProviderId: string }>({
  name: 'sub/ses/lc/sessionProvider/created',
  redisUrl: env.service.REDIS_URL
});

export let sessionProviderCreatedQueueProcessor = sessionProviderCreatedQueue.process(
  async data => {
    let sessionProvider = await db.sessionProvider.findUniqueOrThrow({
      where: { id: data.sessionProviderId }
    });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: sessionProvider.tenantOid,
          solutionOid: sessionProvider.solutionOid,
          environmentOid: sessionProvider.environmentOid,
          providerOid: sessionProvider.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: sessionProvider.tenantOid,
        solutionOid: sessionProvider.solutionOid,
        environmentOid: sessionProvider.environmentOid,
        providerOid: sessionProvider.providerOid,
        sessions: 1,
        firstSessionAt: new Date(),
        lastSessionAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        sessions: { increment: 1 },
        lastSessionAt: new Date(),
        lastUseAt: new Date()
      }
    });
  }
);
