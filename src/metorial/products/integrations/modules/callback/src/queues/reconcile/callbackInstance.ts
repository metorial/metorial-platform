import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { callbackInternalService } from '../../services/callbackInternal';

export let callbackInstanceReconcileManyQueue = createQueue<{
  integrationProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cb/rec/callbackInstance/many',
  redisUrl: env.service.REDIS_URL
});

export let callbackInstanceReconcileManyQueueProcessor =
  callbackInstanceReconcileManyQueue.process(
    async data =>
      await callbackInternalService.reconcileCallbackInstancesForIntegrationProvider(data)
  );

export let callbackInstanceReconcileQueue = createQueue<{
  integrationInstanceProviderId: string;
}>({
  name: 'sub/cb/rec/callbackInstance',
  redisUrl: env.service.REDIS_URL
});

export let enqueueCallbackInstanceReconcile = async (d: {
  integrationInstanceProviderId: string;
}) => {
  await callbackInstanceReconcileQueue.add(d, { id: d.integrationInstanceProviderId });
};

export let callbackInstanceReconcileQueueProcessor = callbackInstanceReconcileQueue.process(
  async data =>
    await callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider(data)
);
