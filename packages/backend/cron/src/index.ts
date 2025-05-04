import { getConfig } from '@metorial/config';
import { createExecutionContext, provideExecutionContext } from '@metorial/execution-context';
import { generateCustomId } from '@metorial/id';
import { IQueueProcessor } from '@metorial/queue';
import { parseRedisUrl } from '@metorial/redis';
import { Queue, Worker } from 'bullmq';

let log = (...any: any[]) => console.log('[CRON MANAGER]:', ...any);

let seenNames = new Set<string>();

export let createCron = (
  opts: {
    name: string;
    cron: string;
  },
  handler: () => Promise<void>
): IQueueProcessor => {
  if (seenNames.has(opts.name)) {
    throw new Error(`Cron with name ${opts.name} already exists`);
  }

  let connection = parseRedisUrl(getConfig().redisUrl);
  let queue = new Queue(opts.name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true
    }
  });

  return {
    start: async () => {
      log(`Starting cron job ${opts.name} to run every ${opts.cron} using bullmq`);

      await queue.upsertJobScheduler(
        'cron',
        {
          pattern: opts.cron
        },
        {
          opts: {
            removeDependencyOnFailure: true,
            removeOnComplete: true,
            removeOnFail: true,
            keepLogs: 0
          }
        }
      );

      let worker = new Worker(
        opts.name,
        async () => {
          provideExecutionContext(
            createExecutionContext({
              type: 'scheduled',
              contextId: generateCustomId('cron_'),
              cron: opts.cron,
              name: opts.name
            }),
            async () => {
              log(`Running cron job ${opts.name}`);

              await handler();
            }
          );
        },
        { connection }
      );

      return {
        close: worker.close.bind(worker)
      };
    }
  };
};
