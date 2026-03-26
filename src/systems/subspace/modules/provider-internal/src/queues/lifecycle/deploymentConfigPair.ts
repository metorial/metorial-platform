import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerDeploymentConfigPairSyncSpecificationQueue } from '../deploymentConfigPair/syncSpec';

export let providerDeploymentConfigPairCreatedQueue = createQueue<{
  providerDeploymentConfigPairId: string;
}>({
  name: 'sub/pint/lc/providerDeploymentConfigPair/created',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentConfigPairCreatedQueueProcessor =
  providerDeploymentConfigPairCreatedQueue.process(async data => {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { id: data.providerDeploymentConfigPairId },
      select: { id: true }
    });
    if (!pair) throw new QueueRetryError();

    await callbackRegistrationReconcileQueue.add({
      providerDeploymentConfigPairId: pair.id
    });
  });

export let providerDeploymentConfigPairVersionCreatedQueue = createQueue<{
  providerDeploymentConfigPairVersionId: string;
}>({
  name: 'sub/pint/lc/providerDeploymentConfigPair/ver/created',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentConfigPairVersionCreatedQueueProcessor =
  providerDeploymentConfigPairVersionCreatedQueue.process(async data => {
    let version = await db.providerDeploymentConfigPairProviderVersion.findFirst({
      where: { id: data.providerDeploymentConfigPairVersionId },
      include: { version: true, pair: true }
    });
    if (!version) throw new QueueRetryError();

    await providerDeploymentConfigPairSyncSpecificationQueue.add({
      providerDeploymentConfigPairId: version.pair.id,
      versionId: version.version.id
    });
  });

export let callbackRegistrationReconcileQueue = createQueue<{
  callbackId?: string;
  callbackInstanceId?: string;
  providerDeploymentConfigPairId?: string;
}>({
  name: 'sub/callback/reconcile',
  redisUrl: env.service.REDIS_URL
});
