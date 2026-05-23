import { createCron } from '@mtsrc/cron';
import { createQueue } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerConfigVaultDeletedQueue } from '../lifecycle/providerConfigVault';
import { getCutoffDate } from './_config';

export let providerConfigVaultArchivedCleanupCron = createCron(
  {
    name: 'sub/dep/cron/providerConfigVaultArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await providerConfigVaultDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let providerConfigVaultDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/dep/delete/providerConfigVault/many',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigVaultDeleteManyQueueProcessor =
  providerConfigVaultDeleteManyQueue.process(async data => {
    let vaults = await db.providerConfigVault.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (vaults.length === 0) return;

    await providerConfigVaultDeleteQueue.addMany(
      vaults.map(vault => ({ providerConfigVaultId: vault.id }))
    );

    await providerConfigVaultDeleteManyQueue.add({
      cursor: vaults[vaults.length - 1].id
    });
  });

export let providerConfigVaultDeleteQueue = createQueue<{ providerConfigVaultId: string }>({
  name: 'sub/dep/delete/providerConfigVault',
  redisUrl: env.service.REDIS_URL
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
