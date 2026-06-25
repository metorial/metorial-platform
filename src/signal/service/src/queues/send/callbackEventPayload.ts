import { Hash } from '@lowerdeck/hash';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { storageKey } from '../../lib/storageKey';
import { storage } from '../../storage';

export let offloadCallbackEventPayloadQueue = createQueue<{
  callbackEventId: string;
  payloadType: 'input' | 'output';
  payloadHash: string;
}>({
  name: 'sgnl/cbe/offload',
  redisUrl: env.service.REDIS_URL
});

export let offloadCallbackEventPayloadQueueProcessor =
  offloadCallbackEventPayloadQueue.process(async data => {
    let callbackEvent = await db.callbackEvent.findFirst({
      where: { id: data.callbackEventId }
    });
    if (!callbackEvent) throw new QueueRetryError();

    let payloadJson =
      data.payloadType === 'input' ? callbackEvent.inputJson : callbackEvent.outputJson;
    if (payloadJson === null) return;

    let currentHash = await Hash.sha256(payloadJson);
    if (currentHash !== data.payloadHash) return;

    let key =
      data.payloadType === 'input'
        ? storageKey.callbackEventInput(callbackEvent)
        : storageKey.callbackEventOutput(callbackEvent);

    await storage.putObject(env.storage.LOGS_BUCKET_NAME, key, payloadJson);

    await db.callbackEvent.updateMany({
      where: {
        id: data.callbackEventId
      },
      data:
        data.payloadType === 'input'
          ? {
              inputJson: null,
              inputStorageKey: key
            }
          : {
              outputJson: null,
              outputStorageKey: key
            }
    });
  });
