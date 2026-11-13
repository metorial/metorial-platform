import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { endIdleSessions, idleSessions } from '../lib/state';

let pageSize = 500;

type Transition = 'idle' | 'ended';

export let sessionStateCron = createCron(
  {
    name: 'at/session/state',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 10_000
  },
  async () => {
    await sessionStateQueue.addMany([{ transition: 'idle' }, { transition: 'ended' }]);
  }
);

export let sessionStateQueue = createQueue<{ transition: Transition }>({
  name: 'at/session/state/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let sessionStatePageProcessor = sessionStateQueue.process(async data => {
  let now = new Date();
  let count =
    data.transition == 'idle'
      ? await idleSessions({ now, limit: pageSize })
      : await endIdleSessions({ now, limit: pageSize });

  if (count == pageSize) await sessionStateQueue.add({ transition: data.transition });
});

export let sessionStateProcessor = combineQueueProcessors([
  sessionStateCron,
  sessionStatePageProcessor
]);
