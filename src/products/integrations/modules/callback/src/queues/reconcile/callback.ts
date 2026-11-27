import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { callbackInternalService } from '../../services/callbackInternal';

export let callbackReconcileQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/cb/rec/callback',
  redisUrl: env.service.REDIS_URL
});

export let enqueueCallbackReconcile = async (d: { integrationProviderId: string }) => {
  await callbackReconcileQueue.add(d);
};

export let callbackReconcileQueueProcessor = callbackReconcileQueue.process(async data => {
  await callbackInternalService.reconcileCallbackForIntegrationProvider(data);
});

export let callbackReconcileForIntegrationManyQueue = createQueue<{
  integrationId: string;
  cursor?: string;
}>({
  name: 'sub/cb/rec/callback/integrationMany',
  redisUrl: env.service.REDIS_URL
});

export let enqueueCallbackReconcileForIntegration = async (d: { integrationId: string }) => {
  await callbackReconcileForIntegrationManyQueue.add(d);
};

export let callbackReconcileForIntegrationManyQueueProcessor =
  callbackReconcileForIntegrationManyQueue.process(
    async data => await callbackInternalService.reconcileCallbacksForIntegration(data)
  );
