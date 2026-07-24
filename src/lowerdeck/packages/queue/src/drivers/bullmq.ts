import { delay } from '@lowerdeck/delay';
import {
  createExecutionContext,
  provideExecutionContext,
  withExecutionContextOptional
} from '@lowerdeck/execution-context';
import type { ExecutionContext } from '@lowerdeck/execution-context';
import { generateSnowflakeId } from '@lowerdeck/id';
import { memo } from '@lowerdeck/memo';
import { parseRedisUrl } from '@lowerdeck/redis';
import { getSentry } from '@lowerdeck/sentry';
import {
  hasActiveTraceContext,
  isTelemetryEnabled,
  SpanKind,
  SpanStatusCode,
  trace
} from '@lowerdeck/telemetry';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { DeduplicationOptions, JobsOptions, QueueOptions, WorkerOptions } from 'bullmq';
import { QueueRetryError } from '../lib/queueRetryError';
import type { IQueue } from '../types';

// @ts-ignore
import SuperJson from 'superjson';

let Sentry = getSentry();

let log = (...any: any[]) => console.log('[QUEUE MANAGER]:', ...any);

let anyQueueStartedRef = { started: false };
let tracer = trace.getTracer('lowerdeck.queue.bullmq');

let compactAttributes = (
  attributes: Record<string, string | number | boolean | undefined>
) => {
  let out: Record<string, string | number | boolean> = {};

  for (let [key, value] of Object.entries(attributes)) {
    if (value !== undefined) out[key] = value;
  }

  return out;
};

let withQueueSpan = async <T>(
  d: {
    name: string;
    kind: SpanKind;
    queueName: string;
    operation: 'publish' | 'process';
    attributes?: Record<string, string | number | boolean | undefined>;
    createSpan?: boolean;
  },
  cb: () => Promise<T>
) => {
  if (d.createSpan === false || !isTelemetryEnabled() || !hasActiveTraceContext()) {
    return await cb();
  }

  return await tracer.startActiveSpan(
    d.name,
    {
      kind: d.kind,
      attributes: compactAttributes({
        'sentry.op': `queue.${d.operation}`,
        'messaging.system': 'bullmq',
        'messaging.operation': d.operation,
        'messaging.destination.name': d.queueName,
        ...d.attributes
      })
    },
    async span => {
      try {
        return await cb();
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
};

let getSerializedExecutionContext = (
  ctx: ExecutionContext | null
): ExecutionContext | null => {
  if (ctx) {
    return createExecutionContext({ ...ctx });
  }

  if (!isTelemetryEnabled() || !hasActiveTraceContext()) {
    return null;
  }

  // Preserve the active trace even when queue publish happens outside an execution context.
  return createExecutionContext({
    type: 'unknown',
    contextId: generateSnowflakeId()
  });
};

let sanitizeJobId = (jobId?: string) => jobId?.replace(/:/g, '_');

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
  redisUrl: string;
}

export let createBullMqQueue = <JobData>(
  opts: BullMqCreateOptions
): IQueue<JobData, BullMqQueueOptions> => {
  let redisOpts = parseRedisUrl(opts.redisUrl);
  if (process.env.QUEUE_DEBUG_LOGGING)
    console.log('Creating queue with connection', opts.name, opts.redisUrl, redisOpts);

  // Worker-only processes define hundreds of queues. Constructing every producer Queue
  // eagerly opens a Redis connection even when that process never publishes to it.
  let useQueue = memo(
    () =>
      new Queue<JobData>(opts.name, {
        ...opts.queueOpts,
        connection: redisOpts,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: {
            age: 60 * 60 * 24 // 1 day
          },
          backoff: {
            type: 'custom'
          },
          attempts: 25,
          keepLogs: 10,
          ...opts.jobOpts
        }
      })
  );

  let useQueueEvents = memo(() => new QueueEvents(opts.name, { connection: redisOpts }));

  let publishMany = async (
    payloads: Array<{
      data: JobData;
      opts?: BullMqQueueOptions;
    }>,
    queueAddOpts?: BullMqQueueOptions
  ) => {
    await withExecutionContextOptional(async ctx => {
      let serializedExecutionContext = getSerializedExecutionContext(ctx);

      await withQueueSpan(
        {
          name: `queue publish batch: ${opts.name}`,
          kind: SpanKind.PRODUCER,
          queueName: opts.name,
          operation: 'publish',
          attributes: {
            'messaging.batch.message_count': payloads.length
          }
        },
        async () =>
          await useQueue().addBulk(
            payloads.map(
              payload =>
                ({
                  name: 'j',
                  data: {
                    payload: SuperJson.serialize(payload.data),
                    $$execution_context$$: serializedExecutionContext
                  },
                  opts: {
                    delay: payload.opts?.delay ?? queueAddOpts?.delay,
                    jobId: sanitizeJobId(payload.opts?.id ?? queueAddOpts?.id),
                    deduplication: payload.opts?.deduplication ?? queueAddOpts?.deduplication
                  }
                }) as any
            )
          )
      );
    });
  };

  return {
    name: opts.name,

    add: async (payload, queueAddOpts) => {
      let job = await withExecutionContextOptional(async ctx => {
        let serializedExecutionContext = getSerializedExecutionContext(ctx);

        return await withQueueSpan(
          {
            name: `queue publish: ${opts.name}`,
            kind: SpanKind.PRODUCER,
            queueName: opts.name,
            operation: 'publish'
          },
          async () =>
            await useQueue().add(
              'j' as any,
              {
                payload: SuperJson.serialize(payload),
                $$execution_context$$: serializedExecutionContext
              } as any,
              {
                delay: queueAddOpts?.delay,
                jobId: sanitizeJobId(queueAddOpts?.id),
                deduplication: queueAddOpts?.deduplication
              }
            )
        );
      });

      return {
        async waitUntilFinished(opts?: { timeout?: number }) {
          let events = useQueueEvents();
          await job.waitUntilFinished(events, opts?.timeout);
        }
      };
    },

    addMany: async (payloads, queueAddOpts) => {
      await publishMany(
        payloads.map(payload => ({ data: payload })),
        queueAddOpts
      );
    },

    addManyWithOps: async payloads => {
      await publishMany(payloads.map(payload => ({ data: payload.data, opts: payload.opts })));
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

                let jobExecutionContext = createExecutionContext({
                  type: 'job',
                  contextId: job.id ?? generateSnowflakeId(),
                  queue: opts.name,
                  parent: parentExecutionContext
                });

                await provideExecutionContext(
                  jobExecutionContext,
                  async () =>
                    await withQueueSpan(
                      {
                        name: `queue process: ${opts.name}`,
                        kind: SpanKind.CONSUMER,
                        queueName: opts.name,
                        operation: 'process',
                        createSpan: true,
                        attributes: {
                          'messaging.message.id': job.id ? String(job.id) : undefined,
                          'messaging.message.retry.count': job.attemptsMade
                        }
                      },
                      async () => await cb(payload as any, job)
                    )
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
              connection: redisOpts,
              autorun: false,

              settings: {
                ...opts.workerOpts?.settings,

                backoffStrategy: (attemptsMade: number) => {
                  let baseDelay = 1000;
                  let maxDelay = 1000 * 60 * 10; // 10 minutes

                  let delay = baseDelay * Math.pow(2, attemptsMade - 1);
                  if (delay > maxDelay) delay = maxDelay;

                  return delay;
                }
              }
            }
          );

          // Do not let the processor-composition layer move on to the next queue until
          // this worker has an established Redis connection.
          try {
            await worker.waitUntilReady();
          } catch (error) {
            await worker.close(true);
            throw error;
          }
          void worker.run().catch(error => {
            Sentry.captureException(error, {
              tags: {
                queueName: opts.name,
                queueOperation: 'run'
              }
            });
            console.error(`Queue ${opts.name} stopped unexpectedly`, error);
          });

          return {
            close: () => worker.close()
          };
        }
      };
    }
  };
};
