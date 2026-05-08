import { ServiceError, notFoundError } from '@lowerdeck/error';
import { db, ID, Prisma, withTransaction } from '@metorial/db';
import { createQueue, QueueRetryError, type IQueue } from '@metorial/queue';
import { assistants } from '../definitions/assistants';
import { Model } from '../lib/definitions';
import { AgentRun, AgentRunUsage } from '../lib/run';
import { createAssistantRunDeltaPublisher } from '../lib/run/redisDeltas';
import { InputMessage, State } from '../proto/types';

type ProcessAssistantRequestJob = {
  assistantRequestId: string;
};

export let processAssistantRequestQueue: IQueue<ProcessAssistantRequestJob, any> =
  createQueue<ProcessAssistantRequestJob>({
    name: 'assistant/request/process'
  });

type AssistantDefinition = Awaited<(typeof assistants)[keyof typeof assistants]>;

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

let getInputMessage = (state: Prisma.JsonValue): InputMessage => {
  let parsed = state as unknown as State;
  let item = parsed.items?.find(item => item.type == 'message' && item.message.role == 'user');

  if (!item || item.type != 'message') {
    throw new ServiceError(notFoundError('assistant_message', 'user'));
  }

  return {
    parts: item.message.parts
  };
};

let getAssistantDefinition = async (
  implementationSlug: string
): Promise<AssistantDefinition> => {
  let definitions = await Promise.all(Object.values(assistants));
  let definition = definitions.find(
    definition => definition.implementation._persisted.slug == implementationSlug
  );

  if (!definition) {
    throw new ServiceError(notFoundError('assistant_implementation', implementationSlug));
  }

  return definition;
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
        actor: true,
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
            instance: true,
            organization: true
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
    let conversationOid = request.conversationOid;
    let assistantOid = request.assistantOid;
    let assistantInstanceOid = request.assistantInstanceOid;
    let modelOid = request.modelOid;
    let startedAt = new Date();
    let run = await withTransaction(async db => {
      let existingRun = await db.assistantRun.findFirst({
        where: {
          requestOid: request.oid
        },
        orderBy: {
          oid: 'desc'
        }
      });
      if (existingRun) return existingRun;

      let run = await db.assistantRun.create({
        data: {
          id: await ID.generateId('assistantRun'),
          status: 'running',
          requestOid: request.oid,
          conversationOid,
          assistantOid,
          assistantInstanceOid,
          cost: zeroCost,
          metadata: {
            startedAt: startedAt.toISOString()
          } satisfies PrismaJson.AssistantRunMetadata
        }
      });

      await db.assistantMessage.update({
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

    await db.assistantRun.update({
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
      let model = definition.implementation.availableModels.find(
        model => model._persisted.oid == modelOid
      );
      if (!model) throw new ServiceError(notFoundError('assistant_model', requestModel.id));

      let agent = await definition.implementation.getAgent({
        model,
        instance: conversation.instance,
        organization: conversation.organization,
        assistant: conversation.assistant,
        assistantImplementation: definition.implementation._persisted
      });

      let runner = new AgentRun(
        agent,
        model,
        conversation.instance,
        conversation.organization,
        conversation.assistant,
        definition.implementation
      );
      let result = await runner.run({
        input: getInputMessage(inputMessage.state),
        conversation,
        lastMessageId: parentMessage.id,
        historySize,
        delta: publisher.delta
      });
      let completedAt = new Date();
      let cost = calculateCost(result.usage, model);

      await withTransaction(async db => {
        let assistantMessage = await db.assistantMessage.create({
          data: {
            id: await ID.generateId('assistantMessage'),
            type: 'assistant',
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

        await db.assistantConversationItem.create({
          data: {
            id: await ID.generateId('assistantConversationItem'),
            conversationOid: conversation.oid,
            messageOid: assistantMessage.oid
          }
        });

        await db.assistantRequest.update({
          where: {
            oid: request.oid
          },
          data: {
            status: 'completed'
          }
        });

        await db.assistantRun.update({
          where: {
            oid: run.oid
          },
          data: {
            status: 'completed',
            cost,
            metadata: {
              ...result.metadata,
              startedAt: startedAt.toISOString(),
              completedAt: completedAt.toISOString(),
              durationMs: completedAt.getTime() - startedAt.getTime(),
              finalSnapshotIndex: result.snapshotIndex
            } satisfies PrismaJson.AssistantRunMetadata
          }
        });
      });
    } catch (error) {
      if (error instanceof QueueRetryError) throw error;

      await withTransaction(async db => {
        await db.assistantRequest.update({
          where: {
            oid: request.oid
          },
          data: {
            status: 'failed'
          }
        });

        await db.assistantRun.update({
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
    } finally {
      await publisher.close();
    }
  }
);
