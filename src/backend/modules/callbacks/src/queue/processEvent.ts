import { db, ID } from '@metorial/db';
import { lambdaServerCallbackService } from '@metorial/module-custom-server';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getConnectionLambda } from '../lib/getLambda';

export let processEventQueue = createQueue<{ eventId: string }>({
  name: 'clb/evt/proc'
});

export let processEventQueueProcessor = processEventQueue.process(async data => {
  let event = await db.callbackEvent.findFirst({
    where: { id: data.eventId },
    include: { callback: true }
  });
  if (!event) throw new QueueRetryError();

  let callbackData = await getConnectionLambda(event.callback.id);
  if (!callbackData.lambdaInstance) return;

  let res = await lambdaServerCallbackService.handleLambdaServerCallback({
    events: [event],
    callback: event.callback,
    lambda: callbackData.lambdaInstance
  });

  for (let r of res) {
    if (r.success) {
      await db.callbackEvent.updateMany({
        where: { id: r.event.id },
        data: {
          status: 'succeeded',
          attemptCount: { increment: 1 },
          payloadOutgoing: JSON.stringify(r.result)
        }
      });

      await db.callbackEventProcessingAttempt.createMany({
        data: {
          id: await ID.generateId('callbackEventProcessingAttempt'),
          callbackEventOid: r.event.oid,
          status: 'succeeded',
          attemptIndex: r.event.attemptCount
        }
      });

      if (event.callback.consecutiveEventFailures) {
        await db.callback.updateMany({
          where: { id: event.callback.id },
          data: { consecutiveEventFailures: 0 }
        });
      }

      if (r.result !== null && r.result !== undefined) {
      }
    } else {
      if (event.attemptCount >= 5) {
        await db.callbackEvent.updateMany({
          where: { id: r.event.id },
          data: { status: 'failed', attemptCount: { increment: 1 } }
        });
      } else {
        await db.callbackEvent.updateMany({
          where: { id: r.event.id },
          data: { status: 'retrying', attemptCount: { increment: 1 } }
        });

        await processEventQueue.add(
          {
            eventId: r.event.id
          },
          {
            delay: Math.min(30000, 1000 * 2 ** r.event.attemptCount)
          }
        );
      }

      await db.callbackEventProcessingAttempt.createMany({
        data: {
          id: await ID.generateId('callbackEventProcessingAttempt'),
          callbackEventOid: r.event.oid,
          status: 'failed',
          attemptIndex: r.event.attemptCount,
          errorCode: r.error?.code,
          errorMessage: r.error?.message
        }
      });

      await db.callback.updateMany({
        where: { id: event.callback.id },
        data: { consecutiveEventFailures: { increment: 1 } }
      });
    }
  }
});
