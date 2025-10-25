import { db } from '@metorial/db';
import { lambdaServerCallbackService } from '@metorial/module-custom-server';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { env } from '../env';

export let installCallbackQueue = createQueue<{ callbackId: string; lambdaId: string }>({
  name: 'clb/clb/ins'
});

export let installCallbackQueueProcessor = installCallbackQueue.process(async data => {
  let callback = await db.callback.findFirst({
    where: { id: data.callbackId },
    include: { hooks: true, instance: true }
  });
  if (!callback || callback.eventType != 'webhook') throw new QueueRetryError();

  let lambda = await db.lambdaServerInstance.findFirst({
    where: { id: data.lambdaId }
  });
  if (!lambda) throw new QueueRetryError();

  await lambdaServerCallbackService.installLambdaServerCallback({
    callback,
    lambda: lambda,
    url: `${env.callbacks.CALLBACKS_URL}/callbacks/hook/${callback.hooks[0].key}`
  });
});
