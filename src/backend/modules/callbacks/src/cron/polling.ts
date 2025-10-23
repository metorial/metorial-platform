import { createCron } from '@metorial/cron';
import { db, ID } from '@metorial/db';
import { lambdaServerCallbackService } from '@metorial/module-custom-server';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { addSeconds } from 'date-fns';
import { getConnectionLambda } from '../lib/getLambda';
import { callbackHandlerService } from '../services/callbackHandler';

export let pollingCron = createCron(
  {
    name: 'clb/pol/crn',
    cron: '* * * * *'
  },
  async () => {
    await pollingManyQueue.add({});
  }
);

let pollingManyQueue = createQueue<{ cursor?: string }>({
  name: 'clb/pol/many'
});

export let pollingManyQueueProcessor = pollingManyQueue.process(async data => {
  let schedules = await db.callbackSchedule.findMany({
    where: {
      nextRunAt: {
        lte: new Date()
      },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: 100
  });
  if (schedules.length == 0) return;

  await pollingSingleQueue.addManyWithOps(
    schedules.map(s => ({
      data: { scheduleId: s.id },
      opts: { id: s.id }
    }))
  );
});

let pollingSingleQueue = createQueue<{ scheduleId: string }>({
  name: 'clb/pol/sing'
});

export let pollingSingleQueueProcessor = pollingSingleQueue.process(async data => {
  let schedule = await db.callbackSchedule.findFirst({
    where: { id: data.scheduleId },
    include: { callback: true }
  });
  if (!schedule) throw new QueueRetryError();

  let callbackData = await getConnectionLambda(schedule.callback.id);
  if (!callbackData.lambdaInstance) return;

  let pollRes = await lambdaServerCallbackService.pollLambdaServerCallback({
    callback: schedule.callback,
    lambda: callbackData.lambdaInstance,
    state: schedule.state
  });

  if (pollRes.success) {
    for (let event of pollRes.events) {
      await callbackHandlerService.handleCallback({
        callback: schedule.callback,
        type: 'polling_result',
        payload: event
      });
    }

    await db.callbackPollingAttempt.createMany({
      data: {
        id: await ID.generateId('callbackPollingAttempt'),
        callbackOid: schedule.callback.oid,
        status: 'succeeded'
      }
    });

    await db.callbackSchedule.updateMany({
      where: { id: schedule.id },
      data: {
        nextRunAt: addSeconds(new Date(), schedule.intervalSeconds),
        state: pollRes.newState ?? undefined
      }
    });

    if (schedule.callback.consecutivePollingFailures) {
      await db.callback.updateMany({
        where: { id: schedule.callback.id },
        data: { consecutivePollingFailures: 0 }
      });
    }
  } else {
    await db.callbackPollingAttempt.createMany({
      data: {
        id: await ID.generateId('callbackPollingAttempt'),
        callbackOid: schedule.callback.oid,
        status: 'failed'
      }
    });

    await db.callbackSchedule.updateMany({
      where: { id: schedule.id },
      data: {
        nextRunAt: addSeconds(new Date(), schedule.intervalSeconds)
      }
    });

    await db.callback.updateMany({
      where: { id: schedule.callback.id },
      data: { consecutivePollingFailures: { increment: 1 } }
    });
  }
});
