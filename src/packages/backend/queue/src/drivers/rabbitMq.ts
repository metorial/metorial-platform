import { getConfig } from '@metorial/config';
import {
  createExecutionContext,
  ExecutionContext,
  provideExecutionContext,
  withExecutionContextOptional
} from '@metorial/execution-context';
import { generateSnowflakeId } from '@metorial/id';
import { getSentry } from '@metorial/sentry';
import amqp, { Channel, Message } from 'amqplib';
import { Job } from 'bullmq';
import SuperJson from 'superjson';
import { IQueue } from '../types';

let Sentry = getSentry();
let log = (...any: any[]) => console.log('[RABBITMQ QUEUE MANAGER]:', ...any);
let anyQueueStartedRef = { started: false };

let globalConnection: amqp.ChannelModel | null = null;
let connectionPromise: Promise<amqp.ChannelModel> | null = null;

let getConnection = async () => {
  if (globalConnection) return globalConnection;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    let url = getConfig().rabbitmqUrl;
    if (!url) throw new Error('RABBITMQ_URL is not set in the environment');
    let connection = await amqp.connect(url);

    connection.on('error', err => {
      log('RabbitMQ connection error:', err);
      globalConnection = null;
      connectionPromise = null;
    });

    connection.on('close', () => {
      log('RabbitMQ connection closed');
      globalConnection = null;
      connectionPromise = null;
    });

    globalConnection = connection;
    connectionPromise = null;
    return connection;
  })();

  return connectionPromise!;
};

interface RabbitMQJobData {
  id: string;
  payload: any;
  $$execution_context$$?: ExecutionContext | null;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  timestamp: number;
  deduplicationKey?: string;
}

export interface RabbitMqQueueOptions {}

export interface RabbitMqCreateOptions {
  name: string;
  jobOpts?: {
    attempts?: number;
  };
  queueOpts?: {
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
  };
  workerOpts?: {
    concurrency?: number;
  };
}

export let createRabbitMqQueue = <JobData>(
  opts: RabbitMqCreateOptions
): IQueue<JobData, RabbitMqQueueOptions> => {
  let queueName = `queue_${opts.name}`;
  let delayedQueueName = `delayed_${opts.name}`;
  let dlqName = `dlq_${opts.name}`;

  let maxAttempts = opts.jobOpts?.attempts || 10;
  let concurrency = opts.workerOpts?.concurrency || 1;

  let setupQueues = async (channel: Channel) => {
    // Main queue
    await channel.assertQueue(queueName, {
      durable: opts.queueOpts?.durable !== false,
      exclusive: opts.queueOpts?.exclusive || false,
      autoDelete: opts.queueOpts?.autoDelete || false
    });

    // Delayed messages queue (with TTL and DLX)
    await channel.assertQueue(delayedQueueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 0, // Will be set per message
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queueName
      }
    });

    // Dead letter queue for failed jobs
    await channel.assertQueue(dlqName, {
      durable: true
    });
  };

  return {
    name: opts.name,

    add: async (payload, queueOpts) => {
      let connection = await getConnection();
      let channel = await connection.createChannel();

      try {
        await setupQueues(channel);

        let jobId = generateSnowflakeId();

        let jobData: RabbitMQJobData = await withExecutionContextOptional(async ctx => ({
          id: jobId,
          payload: SuperJson.serialize(payload),
          $$execution_context$$: ctx,
          attempts: 0,
          maxAttempts,
          timestamp: Date.now()
        }));

        let message = Buffer.from(SuperJson.stringify(jobData));

        await channel.sendToQueue(queueName, message, {
          persistent: true
        });

        return {
          async waitUntilFinished(opts?: { timeout?: number }) {
            // Note: RabbitMQ doesn't have built-in job tracking like BullMQ
            // In a production implementation, you'd need to implement this
            // using a separate tracking mechanism (e.g., Redis, database)
            log('waitUntilFinished not implemented for RabbitMQ queue');
            return Promise.resolve();
          }
        };
      } finally {
        await channel.close();
      }
    },

    addMany: async (payloads, queueOpts) => {
      let connection = await getConnection();
      let channel = await connection.createChannel();

      try {
        await setupQueues(channel);

        await withExecutionContextOptional(async ctx => {
          for (let payload of payloads) {
            let jobId = generateSnowflakeId();

            let jobData: RabbitMQJobData = {
              id: jobId,
              payload: SuperJson.serialize(payload),
              $$execution_context$$: ctx,
              attempts: 0,
              maxAttempts,
              timestamp: Date.now()
            };

            let message = Buffer.from(SuperJson.stringify(jobData));

            await channel.sendToQueue(queueName, message, {
              persistent: true
            });
          }
        });
      } finally {
        await channel.close();
      }
    },

    addManyWithOps: async payloads => {
      let connection = await getConnection();
      let channel = await connection.createChannel();

      try {
        await setupQueues(channel);

        await withExecutionContextOptional(async ctx => {
          for (let { data: payload, opts: queueOpts } of payloads) {
            let jobId = generateSnowflakeId();

            let jobData: RabbitMQJobData = {
              id: jobId,
              payload: SuperJson.serialize(payload),
              $$execution_context$$: ctx,
              attempts: 0,
              maxAttempts,
              timestamp: Date.now()
            };

            let message = Buffer.from(SuperJson.stringify(jobData));

            await channel.sendToQueue(queueName, message, {
              persistent: true
            });
          }
        });
      } finally {
        await channel.close();
      }
    },

    process: cb => {
      let startedRef = { started: false };

      setTimeout(() => {
        if (anyQueueStartedRef.started && !startedRef.started) {
          log(`Queue ${opts.name} was not started within 10 seconds, this is likely a bug`);
        }
      }, 10000);

      return {
        start: async () => {
          log(`Starting queue ${opts.name} using RabbitMQ`);
          startedRef.started = true;
          anyQueueStartedRef.started = true;

          let connection = await getConnection();
          let channel = await connection.createChannel();

          await setupQueues(channel);
          await channel.prefetch(concurrency);

          let processMessage = async (msg: Message | null) => {
            if (!msg) return;

            try {
              let jobData: RabbitMQJobData = SuperJson.parse(msg.content.toString());

              let payload: any;
              try {
                payload = SuperJson.deserialize(jobData.payload);
              } catch (e: any) {
                payload = jobData.payload;
              }

              // Create a mock Job object for compatibility
              let mockJob: Partial<Job> = {
                id: jobData.id,
                data: payload,
                attemptsMade: jobData.attempts,
                opts: {
                  attempts: jobData.maxAttempts,
                  delay: jobData.delay
                }
              };

              let parentExecutionContext = jobData.$$execution_context$$;
              while (
                parentExecutionContext &&
                parentExecutionContext.type === 'job' &&
                parentExecutionContext.parent
              ) {
                parentExecutionContext = parentExecutionContext.parent;
              }

              await provideExecutionContext(
                createExecutionContext({
                  type: 'job',
                  contextId: jobData.id,
                  queue: opts.name,
                  parent: parentExecutionContext ?? undefined
                }),
                () => cb(payload, mockJob as Job)
              );

              // Acknowledge successful processing
              channel.ack(msg);
            } catch (error: any) {
              Sentry.captureException(error);
              console.error('Job processing error:', error);

              try {
                let jobData: RabbitMQJobData = SuperJson.parse(msg.content.toString());
                jobData.attempts += 1;

                if (jobData.attempts < jobData.maxAttempts) {
                  await channel.sendToQueue(
                    queueName,
                    Buffer.from(SuperJson.stringify(jobData)),
                    {
                      persistent: true
                    }
                  );
                } else {
                  // Send to DLQ
                  await channel.sendToQueue(dlqName, msg.content, {
                    persistent: true
                  });
                  log(`Job ${jobData.id} failed permanently, sent to DLQ`);
                }
              } catch (parseError) {
                log('Failed to parse job data for retry logic:', parseError);
                // Send original message to DLQ
                await channel.sendToQueue(dlqName, msg.content, {
                  persistent: true
                });
              }

              // Always acknowledge to prevent infinite redelivery
              channel.ack(msg);
            }
          };

          await channel.consume(queueName, processMessage);

          return {
            close: async () => {
              await channel.close();
              // Note: We don't close the global connection here as it might be shared
            }
          };
        }
      };
    }
  };
};
