import { createCron } from '@lowerdeck/cron';
import {
  combineQueueProcessors,
  createQueue,
  hourlyPacedDelay,
  QueueRetryError
} from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';
import { ssoDelegationService } from '../services/sso/delegation';
import {
  DelegationNotFoundError,
  ssoDelegationClient
} from '../services/sso/delegationClient';

let redisUrl = env.service.REDIS_URL;

export let syncImportedDelegationsCron = createCron(
  {
    name: 'ares/sso/delegation/sync',
    cron: '0 * * * *',
    redisUrl
  },
  async () => {
    await syncImportedDelegationsQueue.add({}, { id: 'scan' });
  }
);

let SYNC_DELEGATIONS_BATCH_SIZE = 500;

export let syncImportedDelegationsQueue = createQueue<{ cursor?: string }>({
  name: 'ares/sso/delegation/syncMany',
  redisUrl,
  workerOpts: { concurrency: 1 }
});

export let syncImportedDelegationQueue = createQueue<{
  delegationId: string;
}>({
  name: 'ares/sso/delegation/syncSingle',
  redisUrl,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let syncImportedDelegationsQueueProcessor = syncImportedDelegationsQueue.process(
  async data => {
    let delegations = await db.ssoImportedDelegation.findMany({
      where: {
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: SYNC_DELEGATIONS_BATCH_SIZE
    });
    if (delegations.length === 0) return;

    await syncImportedDelegationQueue.addManyWithOps(
      delegations.map(delegation => ({
        data: { delegationId: delegation.id },
        opts: { id: delegation.id }
      }))
    );

    if (delegations.length === SYNC_DELEGATIONS_BATCH_SIZE) {
      await syncImportedDelegationsQueue.add(
        { cursor: delegations[delegations.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  }
);

let syncImportedDelegationQueueProcessor = syncImportedDelegationQueue.process(async data => {
  let imported = await db.ssoImportedDelegation.findUnique({
    where: { id: data.delegationId },
    include: {
      app: true,
      remoteInstance: true,
      localExportedDelegation: true
    }
  });
  if (!imported) return;

  try {
    let snapshot = await ssoDelegationClient.getMetadata(imported);
    await ssoDelegationService.storeImport({
      app: imported.app,
      descriptor: {
        id: imported.sourceDelegationId,
        tenantId: imported.sourceTenantId,
        clientId: imported.clientId,
        clientSecret: imported.clientSecret,
        instance: {
          id: imported.remoteInstance.remoteId,
          authorizationUrl: ssoDelegationService.getAuthorizationUrl({
            clientId: imported.clientId,
            endpoint: imported.remoteInstance.authorizationEndpointUrl
          }),
          tokenUrl: imported.remoteInstance.tokenUrl
        }
      },
      snapshot
    });
  } catch (error) {
    if (error instanceof DelegationNotFoundError) {
      await ssoDelegationService.disableImport({
        imported,
        reason: error.message
      });
      return;
    }
    await ssoDelegationService.recordSyncFailure({ imported, error });
    throw new QueueRetryError();
  }
});

export let syncImportedDelegationsProcessor = combineQueueProcessors([
  syncImportedDelegationsCron,
  syncImportedDelegationsQueueProcessor,
  syncImportedDelegationQueueProcessor
]);
