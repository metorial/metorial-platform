import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerConfigVaultDeletedQueue } from '../lifecycle/providerConfigVault';

let providerConfigVaultArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/dep/cron/providerConfigVaultArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/dep/delete/providerConfigVault/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.providerConfigVault.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids =>
    providerConfigVaultDeleteQueue.addMany(ids.map(id => ({ providerConfigVaultId: id })))
});

export let providerConfigVaultArchivedCleanupCron = providerConfigVaultArchivedCleanup.cron;
export let providerConfigVaultDeleteManyQueue = providerConfigVaultArchivedCleanup.manyQueue;
export let providerConfigVaultDeleteManyQueueProcessor =
  providerConfigVaultArchivedCleanup.manyProcessor;

export let providerConfigVaultDeleteQueue = createQueue<{ providerConfigVaultId: string }>({
  name: 'sub/dep/delete/providerConfigVault',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
});

export let providerConfigVaultDeleteQueueProcessor = providerConfigVaultDeleteQueue.process(
  async data => {
    let vault = await db.providerConfigVault.findUnique({
      where: { id: data.providerConfigVaultId }
    });
    if (!vault || vault.status !== 'archived') return;

    await db.providerConfigVault.updateMany({
      where: { oid: vault.oid },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {}
      }
    });

    await providerConfigVaultDeletedQueue.add({ providerConfigVaultId: vault.id });
  }
);
