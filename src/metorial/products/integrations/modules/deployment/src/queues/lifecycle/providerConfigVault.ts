import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderConfigVaultQueue } from '../search/providerConfigVault';
import { providerConfigArchivedQueue } from './providerConfig';

export let providerConfigVaultCreatedQueue = createQueue<{ providerConfigVaultId: string }>({
  name: 'sub/dep/lc/providerConfigVault/created',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigVaultCreatedQueueProcessor = providerConfigVaultCreatedQueue.process(
  async data => {
    await indexProviderConfigVaultQueue.add({
      providerConfigVaultId: data.providerConfigVaultId
    });
  }
);

export let providerConfigVaultUpdatedQueue = createQueue<{ providerConfigVaultId: string }>({
  name: 'sub/dep/lc/providerConfigVault/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigVaultUpdatedQueueProcessor = providerConfigVaultUpdatedQueue.process(
  async data => {
    await indexProviderConfigVaultQueue.add({
      providerConfigVaultId: data.providerConfigVaultId
    });
  }
);

export let providerConfigVaultArchivedQueue = createQueue<{ providerConfigVaultId: string }>({
  name: 'sub/dep/lc/providerConfigVault/archived',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigVaultArchivedQueueProcessor =
  providerConfigVaultArchivedQueue.process(async data => {
    let vault = await db.providerConfigVault.findUnique({
      where: { id: data.providerConfigVaultId }
    });
    if (!vault) return;

    let archivedAt = vault.archivedAt ?? new Date();

    await indexProviderConfigVaultQueue.add({
      providerConfigVaultId: data.providerConfigVaultId
    });

    await providerConfigVaultArchiveConfigsManyQueue.add({
      providerConfigVaultId: data.providerConfigVaultId
    });
  });

export let providerConfigVaultArchiveConfigsManyQueue = createQueue<{
  providerConfigVaultId: string;
  cursor?: string;
}>({
  name: 'sub/dep/lc/providerConfigVault/archiveConfigsMany',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigVaultArchiveConfigsManyQueueProcessor =
  providerConfigVaultArchiveConfigsManyQueue.process(async data => {
    let vault = await db.providerConfigVault.findUnique({
      where: { id: data.providerConfigVaultId }
    });
    if (!vault || vault.status !== 'archived') return;

    let archivedAt = vault.archivedAt ?? new Date();

    let configs = await db.providerConfig.findMany({
      where: {
        OR: [{ oid: vault.configOid }, { fromVaultOid: vault.oid }],
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { oid: true, id: true }
    });
    if (configs.length === 0) return;

    await db.providerConfig.updateMany({
      where: { oid: { in: configs.map(c => c.oid) }, status: 'active' },
      data: { status: 'archived', archivedAt }
    });

    await providerConfigArchivedQueue.addMany(
      configs.map(config => ({
        providerConfigId: config.id
      }))
    );

    await providerConfigVaultArchiveConfigsManyQueue.add({
      providerConfigVaultId: data.providerConfigVaultId,
      cursor: configs[configs.length - 1].id
    });
  });

export let providerConfigVaultDeletedQueue = createQueue<{ providerConfigVaultId: string }>({
  name: 'sub/dep/lc/providerConfigVault/deleted',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigVaultDeletedQueueProcessor = providerConfigVaultDeletedQueue.process(
  async data => {
    await indexProviderConfigVaultQueue.add({
      providerConfigVaultId: data.providerConfigVaultId
    });
  }
);
