import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexProviderConfigVaultQueue } from '../search/providerConfigVault';

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
