import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { subMinutes } from 'date-fns';
import { serverRunnerConnectionService } from '../services';

let checkRunnersCron = createCron(
  {
    name: 'srn/run/check',
    cron: '* * * * *'
  },
  async () => {
    let now = new Date();
    let oneMinuteAgo = subMinutes(now, 1);

    let cursorId: string | undefined = undefined;

    while (true) {
      let runnersToStop = await db.serverRunner.findMany({
        where: {
          status: 'online',
          lastSeenAt: {
            lte: oneMinuteAgo
          },
          id: {
            gt: cursorId
          }
        },
        orderBy: {
          id: 'asc'
        },
        take: 100
      });
      if (runnersToStop.length === 0) break;

      stopRunnerQueue.addMany(
        runnersToStop.map(runner => ({
          runnerId: runner.id,
          lastSeenAt: runner.lastSeenAt
        }))
      );

      cursorId = runnersToStop[runnersToStop.length - 1].id as string;
    }
  }
);

let stopRunnerQueue = createQueue<{ runnerId: string; lastSeenAt: Date | null }>({
  name: 'srn/run/stop'
});

let stopRunnerQueueProcessor = stopRunnerQueue.process(async data => {
  let runner = await db.serverRunner.findFirst({
    where: {
      id: data.runnerId,
      lastSeenAt: data.lastSeenAt
    }
  });
  if (!runner) return;

  await serverRunnerConnectionService.unregisterServerRunner({
    runner
  });
});

export let checkRunnersProcessors = combineQueueProcessors([
  checkRunnersCron,
  stopRunnerQueueProcessor
]);
