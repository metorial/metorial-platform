import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { callbackInternalService } from '../../services/callbackInternal';

export let callbackReconcileQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/cb/rec/callback',
  redisUrl: env.service.REDIS_URL
});

export let enqueueCallbackReconcile = async (d: { integrationProviderId: string }) => {
  await callbackReconcileQueue.add(d, { id: d.integrationProviderId });
};

export let callbackReconcileQueueProcessor = callbackReconcileQueue.process(async data => {
  await callbackInternalService.reconcileCallbackForIntegrationProvider(data);
});
