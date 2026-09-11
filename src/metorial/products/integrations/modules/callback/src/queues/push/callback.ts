import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { callbackInternalService } from '../../services/callbackInternal';

export let callbackPushQueue = createQueue<{ callbackId: string }>({
  name: 'sub/cb/push/callback',
  redisUrl: env.service.REDIS_URL
});

export let enqueueCallbackPush = async (d: { callbackId: string }) => {
  await callbackPushQueue.add(d, { id: d.callbackId });
};

export let callbackPushQueueProcessor = callbackPushQueue.process(async data => {
  await callbackInternalService.pushCallbackById(data);
});
