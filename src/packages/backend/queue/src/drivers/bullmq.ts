import { getConfig } from '@metorial/config';
import { delay } from '@metorial/delay';
import {
  createExecutionContext,
  ExecutionContext,
  provideExecutionContext,
  withExecutionContextOptional
} from '@metorial/execution-context';
import { generateSnowflakeId } from '@metorial/id';
import { memo } from '@metorial/memo';
import { parseRedisUrl } from '@metorial/redis';
import { getSentry } from '@metorial/sentry';
import {
  DeduplicationOptions,
  JobsOptions,
  Queue,
  QueueEvents,
  QueueOptions,
  Worker,
  WorkerOptions
} from 'bullmq';
import SuperJson from 'superjson';
import { QueueRetryError } from '../lib/queueRetryError';
import { IQueue } from '../types';

let Sentry = getSentry();

let log = (...any: any[]) => console.log('[QUEUE MANAGER]:', ...any);

let anyQueueStartedRef = { started: false };

export interface BullMqQueueOptions {
  delay?: number;
  id?: string;
  deduplication?: DeduplicationOptions;
}

export interface BullMqCreateOptions {
  name: string;
  jobOpts?: JobsOptions;
  queueOpts?: Omit<QueueOptions, 'connection'>;
  workerOpts?: Omit<WorkerOptions, 'connection'>;
}

export let createBullMqQueue = <JobData>(
  opts: BullMqCreateOptions
): IQueue<JobData, BullMqQueueOptions> => {
  let config = getConfig();
  let redisOpts = parseRedisUrl(config.redisUrl);

  let queue = new Queue<JobData>(opts.name, {
    ...opts.queueOpts,
    connection: redisOpts,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 10,
      keepLogs: 10,
      ...opts.jobOpts
    }
  });

  let useQueueEvents = memo(() => new QueueEvents(opts.name, { connection: redisOpts }));

  return {
    name: opts.name,

    add: async (payload, opts) => {
      let job = await withExecutionContextOptional(
        async ctx =>
          await queue.add(
            'j' as any,
            {
              payload: SuperJson.serialize(payload),
              $$execution_context$$: ctx
            } as any,
            {
              delay: opts?.delay,
              jobId: opts?.id,
              deduplication: opts?.deduplication
            }
          )
      );

      return {
        async waitUntilFinished(opts?: { timeout?: number }) {
          let events = useQueueEvents();
          await job.waitUntilFinished(events, opts?.timeout);
        }
      };
    },

    addMany: async (payloads, opts) => {
      await withExecutionContextOptional(async ctx => {
        await queue.addBulk(
          payloads.map(
            payload =>
              ({
                name: 'j',
                data: {
                  payload: SuperJson.serialize(payload),
                  $$execution_context$$: ctx
                },
                opts: {
                  delay: opts?.delay,
                  jobId: opts?.id,
                  deduplication: opts?.deduplication
                }
              }) as any
          )
        );
      });
    },

    addManyWithOps: async payloads => {
      await withExecutionContextOptional(async ctx => {
        await queue.addBulk(
          payloads.map(
            payload =>
              ({
                name: 'j',
                data: {
                  payload: SuperJson.serialize(payload.data),
                  $$execution_context$$: ctx
                },
                opts: {
                  delay: payload.opts?.delay,
                  jobId: payload.opts?.id,
                  deduplication: payload.opts?.deduplication
                }
              }) as any
          )
        );
      });
    },

    process: cb => {
      let staredRef = { started: false };

      setTimeout(() => {
        if (anyQueueStartedRef.started && !staredRef.started) {
          log(`Queue ${opts.name} was not started within 10 seconds, this is likely a bug`);
        }
      }, 10000);

      return {
        start: async () => {
          log(`Starting queue ${opts.name} using bullmq`);
          staredRef.started = true;
          anyQueueStartedRef.started = true;

          let worker = new Worker<JobData>(
            opts.name,
            async job => {
              try {
                let data = job.data as any;

                let payload: any;

                try {
                  payload = SuperJson.deserialize(data.payload);
                } catch (e: any) {
                  payload = data.payload;
                }

                let parentExecutionContext = (data as any)
                  .$$execution_context$$ as ExecutionContext;
                while (
                  parentExecutionContext &&
                  parentExecutionContext.type == 'job' &&
                  parentExecutionContext.parent
                )
                  parentExecutionContext = parentExecutionContext.parent;

                await provideExecutionContext(
                  createExecutionContext({
                    type: 'job',
                    contextId: job.id ?? generateSnowflakeId(),
                    queue: opts.name,
                    parent: parentExecutionContext
                  }),
                  () => cb(payload as any, job)
                );
              } catch (e: any) {
                if (e instanceof QueueRetryError) {
                  await delay(1000);
                  throw e;
                } else {
                  Sentry.captureException(e);
                  console.error(e);
                  throw e;
                }
              }
            },
            {
              concurrency: 50,
              ...opts.workerOpts,
              connection: redisOpts
            }
          );

          return {
            close: () => worker.close()
          };
        }
      };
    }
  };
};
