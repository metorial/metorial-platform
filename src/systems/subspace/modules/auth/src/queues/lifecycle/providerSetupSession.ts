import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let providerSetupSessionCreatedQueue = createQueue<{
  providerSetupSessionId: string;
}>({
  name: 'sub/auth/lc/providerSetupSession/created',
  redisUrl: env.service.REDIS_URL
});

export let providerSetupSessionCreatedQueueProcessor =
  providerSetupSessionCreatedQueue.process(async data => {});

export let providerSetupSessionUpdatedQueue = createQueue<{
  providerSetupSessionId: string;
}>({
  name: 'sub/auth/lc/providerSetupSession/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerSetupSessionUpdatedQueueProcessor =
  providerSetupSessionUpdatedQueue.process(async data => {});
