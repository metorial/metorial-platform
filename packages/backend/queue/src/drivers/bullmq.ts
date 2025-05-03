import {
  createExecutionContext,
  ExecutionContext,
  provideExecutionContext,
  withExecutionContextOptional
} from '@metorial/execution-context';
import { generateCustomId } from '@metorial/id';
import { memo } from '@metorial/memo';
import { parseRedisUrl } from '@metorial/redis';
import { getSentry } from '@metorial/sentry';
import { JobsOptions, Queue, QueueEvents, QueueOptions, Worker, WorkerOptions } from 'bullmq';
import SuperJson from 'superjson';
import { IQueue } from '../types';

let Sentry = getSentry();

let log = (...any: any[]) => console.log('[QUEUE MANAGER]:', ...any);

export let createBullMqQueue = <JobData>(opts: {
  name: string;
  redisUrl: string;
  jobOpts?: JobsOptions;
  queueOpts?: Omit<QueueOptions, 'connection'>;
  workerOpts?: Omit<WorkerOptions, 'connection'>;
}): IQueue<JobData> => {
  let redisOpts = parseRedisUrl(opts.redisUrl);

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

  let jobId = () => generateCustomId('qjob_');

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
              jobId: jobId()
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
                  jobId: jobId()
                }
              }) as any
          )
        );
      });
    },

    process: cb => ({
      start: async () => {
        log(`Starting queue ${opts.name} using bullmq`);

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
                  contextId: job.id ?? jobId(),
                  queue: opts.name,
                  parent: parentExecutionContext
                }),
                () => cb(payload as any)
              );
            } catch (e: any) {
              Sentry.captureException(e);
              // TODO: add sentry
              console.error(e);
              throw e;
            }
          },
          {
            ...opts.workerOpts,
            connection: redisOpts
          }
        );

        return {
          close: () => worker.close()
        };
      }
    })
  };
};
