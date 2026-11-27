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
  await callbackInstanceReconcileQueue.add(d);
};

export let callbackInstanceReconcileQueueProcessor = callbackInstanceReconcileQueue.process(
  async data =>
    await callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider(data)
);

export let callbackInstanceReconcileForIntegrationInstanceManyQueue = createQueue<{
  integrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/cb/rec/callbackInstance/integrationInstanceMany',
  redisUrl: env.service.REDIS_URL
});

export let enqueueCallbackInstanceReconcileForIntegrationInstance = async (d: {
  integrationInstanceId: string;
}) => {
  await callbackInstanceReconcileForIntegrationInstanceManyQueue.add(d);
};

export let callbackInstanceReconcileForIntegrationInstanceManyQueueProcessor =
  callbackInstanceReconcileForIntegrationInstanceManyQueue.process(
    async data =>
      await callbackInternalService.reconcileCallbackInstancesForIntegrationInstance(data)
  );
