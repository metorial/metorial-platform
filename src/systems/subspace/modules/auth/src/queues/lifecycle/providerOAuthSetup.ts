import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let providerOAuthSetupCreatedQueue = createQueue<{
  providerOAuthSetupId: string;
}>({
  name: 'sub/auth/lc/providerOAuthSetup/created',
  redisUrl: env.service.REDIS_URL
});

export let providerOAuthSetupCreatedQueueProcessor = providerOAuthSetupCreatedQueue.process(
  async data => {}
);

export let providerOAuthSetupUpdatedQueue = createQueue<{
  providerOAuthSetupId: string;
}>({
  name: 'sub/auth/lc/providerOAuthSetup/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerOAuthSetupUpdatedQueueProcessor = providerOAuthSetupUpdatedQueue.process(
  async data => {}
);
