import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderAuthConfigQueue } from '../search/providerAuthConfig';

export let providerAuthConfigCreatedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/created',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigCreatedQueueProcessor = providerAuthConfigCreatedQueue.process(
  async data => {
    let providerAuthConfig = await db.providerAuthConfig.findUniqueOrThrow({
      where: { id: data.providerAuthConfigId }
    });

    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: providerAuthConfig.tenantOid,
          solutionOid: providerAuthConfig.solutionOid,
          environmentOid: providerAuthConfig.environmentOid,
          providerOid: providerAuthConfig.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: providerAuthConfig.tenantOid,
        solutionOid: providerAuthConfig.solutionOid,
        environmentOid: providerAuthConfig.environmentOid,
        providerOid: providerAuthConfig.providerOid,
        authConfigs: 1,
        firstAuthConfigAt: new Date(),
        lastAuthConfigAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        authConfigs: { increment: 1 },
        lastAuthConfigAt: new Date(),
        lastUseAt: new Date()
      }
    });
  }
);

export let providerAuthConfigUpdatedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigUpdatedQueueProcessor = providerAuthConfigUpdatedQueue.process(
  async data => {
    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });
  }
);
