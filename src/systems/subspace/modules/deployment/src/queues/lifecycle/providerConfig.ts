import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderConfigQueue } from '../search/providerConfig';

export let providerConfigCreatedQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/dep/lc/providerConfig/created',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigCreatedQueueProcessor = providerConfigCreatedQueue.process(
  async data => {
    let providerConfig = await db.providerConfig.findUniqueOrThrow({
      where: { id: data.providerConfigId }
    });

    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: providerConfig.tenantOid,
          solutionOid: providerConfig.solutionOid,
          environmentOid: providerConfig.environmentOid,
          providerOid: providerConfig.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: providerConfig.tenantOid,
        solutionOid: providerConfig.solutionOid,
        environmentOid: providerConfig.environmentOid,
        providerOid: providerConfig.providerOid,
        configs: 1,
        firstConfigAt: new Date(),
        lastConfigAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        configs: { increment: 1 },
        lastConfigAt: new Date(),
        lastUseAt: new Date()
      }
    });
  }
);

export let providerConfigUpdatedQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/dep/lc/providerConfig/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigUpdatedQueueProcessor = providerConfigUpdatedQueue.process(
  async data => {
    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });
  }
);
