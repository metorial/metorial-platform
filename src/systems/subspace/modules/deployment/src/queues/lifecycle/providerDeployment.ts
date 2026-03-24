import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderDeploymentQueue } from '../search/providerDeployment';

export let providerDeploymentCreatedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/lc/providerDeployment/created',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentCreatedQueueProcessor = providerDeploymentCreatedQueue.process(
  async data => {
    let providerDeployment = await db.providerDeployment.findUniqueOrThrow({
      where: { id: data.providerDeploymentId }
    });

    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: providerDeployment.tenantOid,
          solutionOid: providerDeployment.solutionOid,
          environmentOid: providerDeployment.environmentOid,
          providerOid: providerDeployment.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: providerDeployment.tenantOid,
        solutionOid: providerDeployment.solutionOid,
        environmentOid: providerDeployment.environmentOid,
        providerOid: providerDeployment.providerOid,
        deployments: 1,
        firstDeploymentAt: new Date(),
        lastDeploymentAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        deployments: { increment: 1 },
        lastDeploymentAt: new Date(),
        lastUseAt: new Date()
      }
    });
  }
);

export let providerDeploymentUpdatedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/lc/providerDeployment/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentUpdatedQueueProcessor = providerDeploymentUpdatedQueue.process(
  async data => {
    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });
  }
);
