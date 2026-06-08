import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { generateCustomId } from '@lowerdeck/id';
import { IQueueProcessor } from '@lowerdeck/queue';
import { parseRedisUrl } from '@lowerdeck/redis';
import { getSentry } from '@lowerdeck/sentry';
import { Queue, Worker } from 'bullmq';

let Sentry = getSentry();

let log = (...any: any[]) => console.log('[CRON MANAGER]:', ...any);

let seenNames = new Set<string>();

export let createCron = (
  opts: {
    name: string;
    cron: string;
    redisUrl: string;
  },
  handler: () => Promise<void>
): IQueueProcessor => {
  if (seenNames.has(opts.name)) {
    throw new Error(`Cron with name ${opts.name} already exists`);
  }

  let connection = parseRedisUrl(opts.redisUrl);
  if (process.env.QUEUE_DEBUG_LOGGING)
    console.log('Creating cron with connection', opts.redisUrl, connection);
  let queue = new Queue(`Cr0N_${opts.name}`, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: {
        age: 60 * 60 * 24 // 1 day
      }
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
        queue.name,
        async () => {
          await provideExecutionContext(
            createExecutionContext({
              type: 'scheduled',
              contextId: generateCustomId('cron_'),
              cron: opts.cron,
              name: opts.name
            }),
            async () => {
              log(`Running cron job ${opts.name}`);

              try {
                await handler();
              } catch (err) {
                Sentry.captureException(err, {
                  tags: {
                    cronName: opts.name
                  }
                });
                throw err;
              }
            }
          );
        },
        {
          connection,
          concurrency: 1
        }
      );

      return {
        close: worker.close.bind(worker)
      };
    }
  };
};
