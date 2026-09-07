import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { callbackInternalService } from '../../services/callbackInternal';

export let callbackInstancePushQueue = createQueue<{ callbackInstanceId: string }>({
  name: 'sub/cb/push/callbackInstance',
  redisUrl: env.service.REDIS_URL
});

export let enqueueCallbackInstancePush = async (d: { callbackInstanceId: string }) => {
  await callbackInstancePushQueue.add(d, { id: d.callbackInstanceId });
};

export let callbackInstancePushQueueProcessor = callbackInstancePushQueue.process(async data => {
  await callbackInternalService.pushCallbackInstanceById(data);
});
