import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { providerOauthDiscoveryService } from '../services';
import { OAuthConfiguration } from '../types';

export let configAutoDiscoveryQueue = createQueue<{ configId: string }>({
  name: 'oat/confdiscau',
  workerOpts: { concurrency: 10, limiter: { max: 25, duration: 1000 } },
  jobOpts: {
    attempts: 25,
    backoff: { type: 'exponential', delay: 1000 }
  }
});

export let configAutoDiscoveryQueueProcessor = configAutoDiscoveryQueue.process(async data => {
  let config = await db.providerOAuthConfig.findUnique({
    where: { id: data.configId }
  });
  if (!config) throw new Error('retry ... not found');

  let autoReg = await providerOauthDiscoveryService.autoRegisterForOauthConfig({
    config: config.config as OAuthConfiguration,
    clientName: 'Metorial Auto Discovery'
  });

  if (autoReg) {
    await db.providerOAuthConfig.update({
      where: { id: config.id },
      data: { discoverStatus: 'supports_auto_registration' }
    });
  } else {
    await db.providerOAuthConfig.update({
      where: { id: config.id },
      data: { discoverStatus: 'manual' }
    });
  }
});
