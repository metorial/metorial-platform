import { createCron } from '@lowerdeck/cron';
import {
  combineQueueProcessors,
  createQueue,
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

export let syncImportedDelegationsQueue = createQueue<Record<string, never>>({
  name: 'ares/sso/delegation/syncMany',
  redisUrl,
  workerOpts: { concurrency: 1 }
});

export let syncImportedDelegationQueue = createQueue<{
  delegationId: string;
}>({
  name: 'ares/sso/delegation/syncSingle',
  redisUrl,
  workerOpts: { concurrency: 10 }
});

let syncImportedDelegationsQueueProcessor =
  syncImportedDelegationsQueue.process(async () => {
    let cursor: string | undefined;
    while (true) {
      let delegations = await db.ssoImportedDelegation.findMany({
        where: {
          status: 'active',
          id: cursor ? { gt: cursor } : undefined
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 500
      });
      if (delegations.length === 0) return;

      await syncImportedDelegationQueue.addManyWithOps(
        delegations.map(delegation => ({
          data: { delegationId: delegation.id },
          opts: { id: delegation.id }
        }))
      );
      if (delegations.length < 500) return;
      cursor = delegations[delegations.length - 1]!.id;
    }
  });

let syncImportedDelegationQueueProcessor =
  syncImportedDelegationQueue.process(async data => {
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
            authorizationUrl:
              ssoDelegationService.getAuthorizationUrl({
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
