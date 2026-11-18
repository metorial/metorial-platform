import { delay } from '@lowerdeck/delay';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { generateCustomId } from '@lowerdeck/id';
import type { IQueueProcessor } from '@lowerdeck/queue';
import { parseRedisUrl } from '@lowerdeck/redis';
import { getSentry } from '@lowerdeck/sentry';
import { Queue, Worker } from 'bullmq';
import { spreadCronPattern, spreadCronStartupJitterMs } from './spread';

export * from './spread';

let Sentry = getSentry();

let log = (...any: any[]) => console.log('[CRON MANAGER]:', ...any);

let seenNames = new Set<string>();

let MANUAL_TRIGGER_JOB_ID = 'manual-trigger';

export interface ICronProcessor extends IQueueProcessor {
  trigger: () => Promise<void>;
}

export let cronQueueName = (name: string) => `Cr0N_${name}`;

/**
 * Asks a running worker of the cron to execute its handler now, in addition to its schedule.
 * Triggers issued while one is still waiting or running collapse into that one.
 */
export let triggerCron = async (opts: { name: string; redisUrl: string }) => {
  let queue = new Queue(cronQueueName(opts.name), {
    connection: parseRedisUrl(opts.redisUrl)
  });

  try {
    await queue.add(
      'trigger',
      {},
      { jobId: MANUAL_TRIGGER_JOB_ID, removeOnComplete: true, removeOnFail: true }
    );
  } finally {
    await queue.close();
  }
};

export let createCron = (
  opts: {
    name: string;
    cron: string;
    redisUrl: string;
    spread?: boolean;
    startupJitterMs?: number;
  },
  handler: () => Promise<void>
): ICronProcessor => {
  if (seenNames.has(opts.name)) {
    throw new Error(`Cron with name ${opts.name} already exists`);
  }

  let pattern = opts.spread === false ? opts.cron : spreadCronPattern(opts.name, opts.cron);

  let connection = parseRedisUrl(opts.redisUrl);
  if (process.env.QUEUE_DEBUG_LOGGING)
    console.log('Creating cron with connection', opts.redisUrl, connection);

  return {
    trigger: () => triggerCron({ name: opts.name, redisUrl: opts.redisUrl }),

    start: async () => {
      log(
        `Starting cron job ${opts.name} to run every ${pattern} using bullmq` +
          (pattern === opts.cron ? '' : ` (declared ${opts.cron}, spread by name)`)
      );

      // Delay Redis connection creation until startup reaches this processor.
      let queue = new Queue(cronQueueName(opts.name), {
        connection,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: {
            age: 60 * 60 * 24 // 1 day
          }
        }
      });

      try {
        await queue.upsertJobScheduler(
          'cron',
          {
            pattern
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
      } catch (error) {
        await queue.close();
        throw error;
      }

      let worker = new Worker(
        queue.name,
        async () => {
          await provideExecutionContext(
            createExecutionContext({
              type: 'scheduled',
              contextId: generateCustomId('cron_'),
              cron: pattern,
              name: opts.name
            }),
            async () => {
              log(`Running cron job ${opts.name}`);

              try {
                if (opts.startupJitterMs)
                  await delay(spreadCronStartupJitterMs(opts.startupJitterMs));

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
          concurrency: 1,
          autorun: false
        }
      );

      try {
        await worker.waitUntilReady();
      } catch (error) {
        await Promise.allSettled([worker.close(true), queue.close()]);
        throw error;
      }
      void worker.run().catch(error => {
        Sentry.captureException(error, {
          tags: {
            cronName: opts.name,
            cronOperation: 'run'
          }
        });
        console.error(`Cron ${opts.name} stopped unexpectedly`, error);
      });

      return {
        close: async () => {
          await worker.close();
          await queue.close();
        }
      };
    }
  };
};
