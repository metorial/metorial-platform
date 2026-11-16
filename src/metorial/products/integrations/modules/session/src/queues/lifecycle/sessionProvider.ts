import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { requestSecurityReview } from '@metorial-subspace/module-security-review-request';
import { env } from '../../env';

export let sessionProviderCreatedQueue = createQueue<{ sessionProviderId: string }>({
  name: 'sub/ses/lc/sessionProvider/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let sessionProviderCreatedQueueProcessor = sessionProviderCreatedQueue.process(
  async data => {
    let sessionProvider = await db.sessionProvider.findUniqueOrThrow({
      where: { id: data.sessionProviderId }
    });

    let use = await db.providerUse.upsert({
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
        projectOid: sessionProvider.projectOid,
        solutionOid: sessionProvider.solutionOid,
        environmentOid: sessionProvider.environmentOid,
        instanceOid: sessionProvider.instanceOid,
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

    if (use.sessions + use.deployments == 1) {
      let provider = await db.provider.findUnique({
        where: { oid: sessionProvider.providerOid },
        select: { id: true }
      });

      if (provider) await requestSecurityReview({ subject: 'provider', id: provider.id });
    }
  }
);
