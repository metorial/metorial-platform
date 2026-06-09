import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createQueue, QueueRetryError, type IQueue } from '@lowerdeck/queue';
import { db, type AssistantMessageStatus, withTransaction } from '../db';
import { env } from '../env';
import { getId } from '../id';
import { type Model } from '../lib/definitions';
import { getAssistantDefinition } from '../lib/definitions/assistantDefinition';
import type { AgentRunUsage } from '../lib/run';
import { AgentRun } from '../lib/run';
import { createAssistantRunDeltaPublisher } from '../lib/run/redisDeltas';
import type { InputMessage, State } from '../types';

type ProcessAssistantRequestJob = {
  assistantRequestId: string;
  handoffResponses?: Array<{
    toolCallId: string;
    toolName: string;
    output: unknown;
  }>;
};

export let processAssistantRequestQueue: IQueue<ProcessAssistantRequestJob, any> =
  createQueue<ProcessAssistantRequestJob>({
    name: 'assistant/request/process',
    redisUrl: env.service.REDIS_URL
  });

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value == 'object' && !Array.isArray(value);

let errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error == 'string') return error;
  if (isRecord(error) && typeof error.message == 'string') return error.message;
  return 'Unknown error';
};

let zeroCost = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  inputCost: 0,
  outputCost: 0,
  totalCost: 0
} satisfies PrismaJson.AssistantRunCost;

let getInputMessage = (state: unknown): InputMessage => {
  let parsed = state as unknown as State;
  let item = parsed.items?.find(item => item.type == 'message' && item.message.role == 'user');

  if (!item || item.type != 'message') {
    throw new ServiceError(notFoundError('assistant_message', 'user'));
  }

  return {
    parts: item.message.parts
  };
};

let calculateCost = (usage: AgentRunUsage, model: Model): PrismaJson.AssistantRunCost => {
  let inputCost = (usage.inputTokens / 1_000_000) * model.inputCostPerMillionTokens;
  let outputCost = (usage.outputTokens / 1_000_000) * model.outputCostPerMillionTokens;

  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  };
};

export let processAssistantRequestQueueProcessor = processAssistantRequestQueue.process(
  async (data: ProcessAssistantRequestJob) => {
    let request = await db.assistantRequest.findUnique({
      where: {
        id: data.assistantRequestId
      },
      include: {
        tenantActor: true,
        message: {
          include: {
            parentMessage: true
          }
        },
        model: {
          include: {
            provider: true
          }
        },
        conversation: {
          include: {
            assistant: {
              include: {
                implementation: true
              }
            },
            assistantInstance: true,
            environment: true,
            tenant: true
          }
        },
        runs: true
      }
    });
    if (!request) throw new QueueRetryError();
    if (request.status != 'pending') return;
    if (!request.conversation || !request.model || !request.message.parentMessage) {
      throw new ServiceError(notFoundError('assistant_request', request.id));
    }

    let conversation = request.conversation;
    let inputMessage = request.message;
    let requestModel = request.model;
    let parentMessage = request.message.parentMessage;
    let historySize = request.historySize ?? 100;
    let startedAt = new Date();
    let existingAssistantMessage = await db.assistantMessage.findFirst({
      where: {
        requestOid: request.oid,
        type: 'assistant'
      },
      orderBy: {
        oid: 'desc'
      }
    });
    let run = await withTransaction(async tx => {
      let existingRun = await tx.modelRun.findFirst({
        where: {
          requestOid: request.oid
        },
        orderBy: {
          oid: 'desc'
        }
      });
      if (existingRun) return existingRun;

      let run = await tx.modelRun.create({
        data: {
          ...getId('modelRun'),
          status: 'running',
          tenantOid: conversation.tenantOid,
          requestOid: request.oid,
          conversationOid: conversation.oid,
          assistantOid: conversation.assistantOid,
          assistantInstanceOid: conversation.assistantInstanceOid,
          modelOid: request.modelOid,
          cost: zeroCost,
          metadata: {
            startedAt: startedAt.toISOString()
          } satisfies PrismaJson.AssistantRunMetadata
        }
      });

      await tx.assistantMessage.update({
        where: {
          oid: inputMessage.oid
        },
        data: {
          runOid: run.oid
        }
      });

      return run;
    });
    let publisher = await createAssistantRunDeltaPublisher({ runId: run.id });

    await db.modelRun.update({
      where: {
        oid: run.oid
      },
      data: {
        status: 'running',
        metadata: {
          startedAt: startedAt.toISOString()
        } satisfies PrismaJson.AssistantRunMetadata
      }
    });

    try {
      let definition = await getAssistantDefinition(
        conversation.assistant.implementation.slug
      );
      let assistantImplementation = definition.implementation;
      let model = assistantImplementation.availableModels.find(
        model => model._persisted.oid == request.modelOid
      );
      if (!model) throw new ServiceError(notFoundError('model', requestModel.id));

      let getAgent = assistantImplementation.getAgent as (
        d: Parameters<typeof assistantImplementation.getAgent>[0] & { input: unknown }
      ) => ReturnType<typeof assistantImplementation.getAgent>;

      let agent = await getAgent({
        input: assistantImplementation.input ? conversation.input : undefined,
        model,
        tenant: conversation.tenant,
        environment: conversation.environment,
        assistant: conversation.assistant,
        assistantInstance: conversation.assistantInstance,
        assistantImplementation: assistantImplementation._persisted
      });

      let runner = new AgentRun(
        agent,
        model,
        conversation.tenant,
        conversation.environment,
        conversation.assistant,
        assistantImplementation._persisted,
        assistantImplementation
      );
      let result =
        data.handoffResponses?.length && existingAssistantMessage
          ? await runner.resume({
              serialized: existingAssistantMessage.serialized,
              state: existingAssistantMessage.state as State,
              responses: data.handoffResponses,
              delta: publisher.delta
            })
          : await runner.run({
              input: getInputMessage(inputMessage.state),
              conversation,
              lastMessageId: parentMessage.id,
              historySize,
              delta: publisher.delta
            });
      let completedAt = new Date();
      let cost = calculateCost(result.usage, model);

      await withTransaction(async tx => {
        let messageStatus: AssistantMessageStatus =
          result.status == 'waiting_for_user' ? 'waiting_for_user' : 'completed';
        let assistantMessage = existingAssistantMessage
          ? await tx.assistantMessage.update({
              where: {
                oid: existingAssistantMessage.oid
              },
              data: {
                status: messageStatus,
                state: result.state,
                serialized: result.serialized
              }
            })
          : await tx.assistantMessage.create({
              data: {
                ...getId('assistantMessage'),
                type: 'assistant',
                status: messageStatus,
                runOid: run.oid,
                requestOid: request.oid,
                assistantOid: conversation.assistantOid,
                assistantInstanceOid: conversation.assistantInstanceOid,
                parentMessageOid: inputMessage.oid,
                modelOid: model._persisted.oid,
                state: result.state,
                serialized: result.serialized
              }
            });

        if (!existingAssistantMessage) {
          await tx.assistantConversationItem.create({
            data: {
              ...getId('assistantConversationItem'),
              conversationOid: conversation.oid,
              messageOid: assistantMessage.oid
            }
          });
        }

        await tx.assistantRequest.update({
          where: {
            oid: request.oid
          },
          data: {
            status: result.status
          }
        });

        await tx.modelRun.update({
          where: {
            oid: run.oid
          },
          data: {
            status: result.status,
            cost,
            metadata: {
              ...result.metadata,
              startedAt: startedAt.toISOString(),
              ...(result.status == 'completed'
                ? { completedAt: completedAt.toISOString() }
                : {}),
              durationMs: completedAt.getTime() - startedAt.getTime(),
              finalSnapshotIndex: result.snapshotIndex
            } satisfies PrismaJson.AssistantRunMetadata
          }
        });
      });
      await publisher.markDone({
        status: result.status
      });
    } catch (error) {
      if (error instanceof QueueRetryError) throw error;

      await withTransaction(async tx => {
        await tx.assistantRequest.update({
          where: {
            oid: request.oid
          },
          data: {
            status: 'failed'
          }
        });

        await tx.modelRun.update({
          where: {
            oid: run.oid
          },
          data: {
            status: 'failed',
            cost: zeroCost,
            metadata: {
              startedAt: startedAt.toISOString(),
              failedAt: new Date().toISOString(),
              error: {
                message: errorMessage(error)
              }
            }
          }
        });
      });
      await publisher.markDone({
        status: 'failed'
      });
    } finally {
      await publisher.close();
    }
  }
);
