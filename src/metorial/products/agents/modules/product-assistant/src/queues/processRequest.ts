import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db, ID, withTransaction, type ProductAssistantMessageStatus } from '@metorial/db';
import { createQueue, QueueRetryError, type IQueue } from '@metorial/queue';
import { type Model } from '../lib/definitions';
import { getAssistantDefinition } from '../lib/definitions/assistantDefinition';
import type { Agent } from '../lib/open-harness';
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
    name: 'pa/request/process'
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
} satisfies PrismaJson.ProductAssistantRunCost;

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

let calculateCost = (
  usage: AgentRunUsage,
  model: Model
): PrismaJson.ProductAssistantRunCost => {
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
    let request = await db.productAssistantRequest.findUnique({
      where: {
        id: data.assistantRequestId
      },
      include: {
        resourceActor: true,
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
            resourceGroup: true,
            resourceTenant: true
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
    let existingAssistantMessage = await db.productAssistantMessage.findFirst({
      where: {
        requestOid: request.oid,
        type: 'assistant'
      },
      orderBy: {
        oid: 'desc'
      }
    });
    let run = await withTransaction(async tx => {
      let existingRun = await tx.productAssistantModelRun.findFirst({
        where: {
          requestOid: request.oid
        },
        orderBy: {
          oid: 'desc'
        }
      });
      if (existingRun) return existingRun;

      let run = await tx.productAssistantModelRun.create({
        data: {
          id: await ID.generateId('productAssistantModelRun'),
          status: 'running',
          resourceTenantOid: conversation.resourceTenantOid,
          requestOid: request.oid,
          conversationOid: conversation.oid,
          assistantOid: conversation.assistantOid,
          assistantInstanceOid: conversation.assistantInstanceOid,
          modelOid: request.modelOid,
          cost: zeroCost,
          metadata: {
            startedAt: startedAt.toISOString()
          } satisfies PrismaJson.ProductAssistantRunMetadata
        }
      });

      await tx.productAssistantMessage.update({
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

    await db.productAssistantModelRun.update({
      where: {
        oid: run.oid
      },
      data: {
        status: 'running',
        metadata: {
          startedAt: startedAt.toISOString()
        } satisfies PrismaJson.ProductAssistantRunMetadata
      }
    });

    let agent: Agent | null = null;

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

      agent = await getAgent({
        input: assistantImplementation.input ? conversation.input : undefined,
        model,
        tenant: conversation.resourceTenant,
        environment: conversation.resourceGroup,
        assistant: conversation.assistant,
        assistantInstance: conversation.assistantInstance,
        assistantImplementation: assistantImplementation._persisted
      });

      let runner = new AgentRun(
        agent,
        model,
        conversation.resourceTenant,
        conversation.resourceGroup,
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
        let messageStatus: ProductAssistantMessageStatus =
          result.status == 'waiting_for_user' ? 'waiting_for_user' : 'completed';
        let assistantMessage = existingAssistantMessage
          ? await tx.productAssistantMessage.update({
              where: {
                oid: existingAssistantMessage.oid
              },
              data: {
                status: messageStatus,
                state: result.state,
                serialized: result.serialized
              }
            })
          : await tx.productAssistantMessage.create({
              data: {
                id: await ID.generateId('productAssistantMessage'),
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
          await tx.productAssistantConversationItem.create({
            data: {
              id: await ID.generateId('productAssistantConversationItem'),
              conversationOid: conversation.oid,
              messageOid: assistantMessage.oid
            }
          });
        }

        await tx.productAssistantRequest.update({
          where: {
            oid: request.oid
          },
          data: {
            status: result.status
          }
        });

        await tx.productAssistantModelRun.update({
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
            } satisfies PrismaJson.ProductAssistantRunMetadata
          }
        });
      });
      await publisher.markDone({
        status: result.status
      });
    } catch (error) {
      if (error instanceof QueueRetryError) throw error;

      await withTransaction(async tx => {
        await tx.productAssistantRequest.update({
          where: {
            oid: request.oid
          },
          data: {
            status: 'failed'
          }
        });

        await tx.productAssistantModelRun.update({
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
      await agent?.close();
      await publisher.close();
    }
  }
);
