import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  AssistantConversation,
  Environment,
  Model as PersistedModel,
  Tenant,
  TenantActor
} from '../db';
import { db, Prisma, withTransaction } from '../db';
import { getId } from '../id';
import type { Implementation } from '../lib/definitions';
import { getAssistantDefinition } from '../lib/definitions/assistantDefinition';
import {
  applyHandoffToolResponses,
  getHandoffToolCalls,
  getWaitingHandoffToolCalls
} from '../lib/run';
import { listenToAssistantRunDeltas } from '../lib/run/redisDeltas';
import { createItemId, type AgentRunWireMessage } from '../lib/run/state';
import { generateAssistantConversationTitleQueue } from '../queues/generateConversationTitle';
import { processAssistantRequestQueue } from '../queues/processRequest';
import { type InputMessage, type State } from '../types';
import { assistantConversationItemInclude } from './message';
import { assistantConversationParticipantService } from './participant';

let serializeInputMessage = (
  input: InputMessage
): PrismaJson.AssistantMessageSerializedContent => ({
  b: 'ai-sdk-1',
  messages: [
    [
      Date.now(),
      {
        role: 'user',
        content: input.parts.map(part => {
          if (part.type == 'text') {
            return {
              type: 'text',
              text: part.text
            };
          }

          return {
            type: 'file',
            filename: part.filename,
            mediaType: part.mediaType,
            data: part.data
          };
        })
      }
    ]
  ]
});

let inputMessageState = (input: InputMessage) =>
  ({
    items: [
      {
        id: createItemId(),
        type: 'message',
        status: 'completed',
        message: {
          role: 'user',
          parts: input.parts
        }
      }
    ]
  }) satisfies State;

export let assistantRequestInclude = {
  tenantActor: true,
  conversation: true,
  assistant: true,
  assistantInstance: true,
  model: {
    include: {
      provider: true
    }
  },
  message: true,
  runs: {
    orderBy: {
      oid: 'desc'
    }
  }
} satisfies Prisma.AssistantRequestInclude;

export type AssistantRequestWithRelations = Prisma.AssistantRequestGetPayload<{
  include: typeof assistantRequestInclude;
}>;

let chooseModel = (d: {
  implementation: Implementation;
  modelId?: string;
}): PersistedModel => {
  if (!d.modelId) return d.implementation.defaultModel._persisted;

  let model = d.implementation.availableModels.find(
    model =>
      model.slug == d.modelId ||
      model.name == d.modelId ||
      model._persisted.id == d.modelId ||
      model._persisted.slug == d.modelId
  );

  if (!model) throw new ServiceError(notFoundError('model', d.modelId));

  return model._persisted;
};

class AssistantRequestServiceImpl {
  private async ensureScope(d: {
    tenant: Tenant;
    environment: Environment;
    actor: TenantActor;
    conversation: AssistantConversation;
    allowAllActors?: boolean;
    client?: typeof db | Prisma.TransactionClient;
  }) {
    let hasAccess = await assistantConversationParticipantService.hasConversationAccess({
      tenant: d.tenant,
      environment: d.environment,
      conversation: d.conversation,
      actor: d.actor,
      client: d.client
    });

    if (hasAccess) return;

    if (d.allowAllActors) {
      await assistantConversationParticipantService.ensureConversationParticipant({
        conversation: d.conversation,
        actor: d.actor,
        client: d.client
      });
      return;
    }

    throw new ServiceError(notFoundError('assistant_conversation', d.conversation.id));
  }

  private async resolveParentMessage(d: {
    conversation: AssistantConversation;
    parentMessageId?: string;
  }) {
    let item = await db.assistantConversationItem.findFirst({
      where: {
        conversationOid: d.conversation.oid,
        message: d.parentMessageId
          ? {
              id: d.parentMessageId
            }
          : undefined
      },
      include: {
        message: true
      },
      orderBy: {
        oid: 'desc'
      }
    });

    if (!item) {
      throw new ServiceError(
        notFoundError(
          'assistant_message',
          d.parentMessageId ?? d.conversation.rootMessageOid.toString()
        )
      );
    }

    return item.message;
  }

  async getAssistantRequestById(d: { requestId: string }) {
    let request = await db.assistantRequest.findFirst({
      where: {
        id: d.requestId
      },
      include: assistantRequestInclude
    });
    if (!request) {
      throw new ServiceError(notFoundError('assistant_request', d.requestId));
    }

    return request;
  }

  private async waitForAssistantRequestRunId(d: {
    request: AssistantRequestWithRelations;
    signal?: AbortSignal;
    pollIntervalMs?: number;
    timeoutMs?: number;
  }) {
    let pollIntervalMs = d.pollIntervalMs ?? 100;
    let timeoutMs = d.timeoutMs ?? 15_000;
    let startedAt = Date.now();

    while (true) {
      if (d.signal?.aborted) {
        throw new Error('Assistant request delta listener aborted');
      }

      let latest = await db.assistantRequest.findUnique({
        where: {
          oid: d.request.oid
        },
        include: assistantRequestInclude
      });
      if (!latest) {
        throw new ServiceError(notFoundError('assistant_request', d.request.id));
      }

      let runId = latest.runs[0]?.id;
      if (runId) return runId;

      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for assistant run for request ${d.request.id}`);
      }

      await new Promise<void>((resolve, reject) => {
        let timeout = setTimeout(() => {
          cleanup();
          resolve();
        }, pollIntervalMs);

        let onAbort = () => {
          cleanup();
          reject(new Error('Assistant request delta listener aborted'));
        };

        let cleanup = () => {
          clearTimeout(timeout);
          d.signal?.removeEventListener('abort', onAbort);
        };

        d.signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
  }

  async createAssistantRequest(d: {
    tenant: Tenant;
    environment: Environment;
    actor: TenantActor;
    conversation: AssistantConversation;
    input: {
      message: InputMessage;
      parentMessageId?: string;
      modelId?: string;
      allowAllActors?: boolean;
    };
  }) {
    let parentMessage = await this.resolveParentMessage({
      conversation: d.conversation,
      parentMessageId: d.input.parentMessageId
    });

    let assistant = await db.assistant.findUnique({
      where: {
        oid: d.conversation.assistantOid
      },
      include: {
        implementation: true
      }
    });
    if (!assistant) {
      throw new ServiceError(
        notFoundError('assistant', d.conversation.assistantOid.toString())
      );
    }

    let definition = await getAssistantDefinition(assistant.implementation.slug);
    let model = chooseModel({
      implementation: definition.implementation,
      modelId: d.input.modelId
    });

    let shouldGenerateTitle = !d.conversation.title?.trim();
    let result = await withTransaction(async tx => {
      await this.ensureScope({
        tenant: d.tenant,
        environment: d.environment,
        actor: d.actor,
        conversation: d.conversation,
        allowAllActors: d.input.allowAllActors,
        client: tx
      });

      let userMessage = await tx.assistantMessage.create({
        data: {
          ...getId('assistantMessage'),
          type: 'user',
          assistantOid: d.conversation.assistantOid,
          assistantInstanceOid: d.conversation.assistantInstanceOid,
          parentMessageOid: parentMessage.oid,
          modelOid: model.oid,
          state: inputMessageState(d.input.message),
          serialized: serializeInputMessage(d.input.message)
        }
      });

      let request = await tx.assistantRequest.create({
        data: {
          ...getId('assistantRequest'),
          status: 'pending',
          conversationOid: d.conversation.oid,
          assistantOid: d.conversation.assistantOid,
          assistantInstanceOid: d.conversation.assistantInstanceOid,
          modelOid: model.oid,
          messageOid: userMessage.oid,
          historySize: 100,
          tenantActorOid: d.actor.oid
        }
      });

      userMessage = await tx.assistantMessage.update({
        where: {
          oid: userMessage.oid
        },
        data: {
          requestOid: request.oid
        }
      });

      let item = await tx.assistantConversationItem.create({
        data: {
          ...getId('assistantConversationItem'),
          conversationOid: d.conversation.oid,
          messageOid: userMessage.oid
        },
        include: assistantConversationItemInclude
      });

      if (shouldGenerateTitle) {
        let userMessageCount = await tx.assistantConversationItem.count({
          where: {
            conversationOid: d.conversation.oid,
            message: {
              type: 'user'
            }
          }
        });

        shouldGenerateTitle = userMessageCount == 1;
      }

      return {
        request,
        userMessage,
        item,
        shouldGenerateTitle
      };
    });

    await processAssistantRequestQueue.add({
      assistantRequestId: result.request.id
    });
    if (result.shouldGenerateTitle) {
      await generateAssistantConversationTitleQueue.add({
        conversationId: d.conversation.id,
        messageId: result.userMessage.id
      });
    }

    return result;
  }

  async respondToAssistantHandoffs(d: {
    tenant: Tenant;
    environment: Environment;
    actor: TenantActor;
    conversation: AssistantConversation;
    input: {
      messageId: string;
      responses: Array<{
        toolCallId: string;
        output: unknown;
      }>;
    };
  }) {
    if (!d.input.responses.length) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one handoff response is required.'
        })
      );
    }

    let item = await db.assistantConversationItem.findFirst({
      where: {
        conversationOid: d.conversation.oid,
        message: {
          id: d.input.messageId
        }
      },
      include: assistantConversationItemInclude
    });
    if (!item) throw new ServiceError(notFoundError('assistant_message', d.input.messageId));

    await this.ensureScope({
      tenant: d.tenant,
      environment: d.environment,
      actor: d.actor,
      conversation: d.conversation
    });

    let message = item.message;
    if (!message.request || message.status != 'waiting_for_user') {
      throw new ServiceError(
        badRequestError({
          message: 'Assistant message is not waiting for handoff responses.'
        })
      );
    }
    if (message.request.status != 'waiting_for_user') {
      throw new ServiceError(
        badRequestError({
          message: 'Assistant request is not waiting for handoff responses.'
        })
      );
    }

    let currentState = message.state as State;
    let waitingBefore = getWaitingHandoffToolCalls(currentState);
    if (!waitingBefore.length) {
      throw new ServiceError(
        badRequestError({
          message: 'Assistant message has no waiting handoff tool calls.'
        })
      );
    }

    let applied: ReturnType<typeof applyHandoffToolResponses>;
    try {
      applied = applyHandoffToolResponses(currentState, d.input.responses);
    } catch (error) {
      throw new ServiceError(
        badRequestError({
          message: error instanceof Error ? error.message : 'Invalid handoff response.'
        })
      );
    }

    let shouldResume = applied.remaining.length == 0;
    let waitingBeforeIds = new Set(waitingBefore.map(({ call }) => call.id));
    let handoffById = new Map(
      getHandoffToolCalls(applied.state).map(({ toolName, call }) => [call.id, { toolName, call }])
    );
    let resumeResponses = [...waitingBeforeIds].map(toolCallId => {
      let handoff = handoffById.get(toolCallId)!;
      return {
        toolCallId,
        toolName: handoff.toolName,
        output: handoff.call.output
      };
    });

    let updatedItem = await withTransaction(async tx => {
      await tx.assistantMessage.update({
        where: {
          oid: message.oid
        },
        data: {
          status: shouldResume ? 'pending' : 'waiting_for_user',
          state: applied.state
        }
      });

      await tx.assistantRequest.update({
        where: {
          oid: message.request!.oid
        },
        data: {
          status: shouldResume ? 'pending' : 'waiting_for_user'
        }
      });

      if (message.run) {
        await tx.modelRun.update({
          where: {
            oid: message.run.oid
          },
          data: {
            status: shouldResume ? 'pending' : 'waiting_for_user'
          }
        });
      }

      return await tx.assistantConversationItem.findUniqueOrThrow({
        where: {
          oid: item.oid
        },
        include: assistantConversationItemInclude
      });
    });

    if (shouldResume) {
      await processAssistantRequestQueue.add({
        assistantRequestId: message.request.id,
        handoffResponses: resumeResponses
      });
    }

    return updatedItem;
  }

  async listenToAssistantRequestDeltas(d: {
    requestId: string;
    signal?: AbortSignal;
    pollIntervalMs?: number;
    runWaitTimeoutMs?: number;
    snapshotWaitTimeoutMs?: number;
    onMessage: (message: AgentRunWireMessage) => void | Promise<void>;
    onError?: (error: Error) => void | Promise<void>;
    onDone?: (message: {
      status: 'completed' | 'waiting_for_user' | 'cancelled' | 'failed';
    }) => void | Promise<void>;
  }) {
    let request = await this.getAssistantRequestById({ requestId: d.requestId });
    let runId =
      request.runs[0]?.id ??
      (await this.waitForAssistantRequestRunId({
        request,
        signal: d.signal,
        pollIntervalMs: d.pollIntervalMs,
        timeoutMs: d.runWaitTimeoutMs
      }));

    return await listenToAssistantRunDeltas({
      runId,
      signal: d.signal,
      snapshotWaitTimeoutMs: d.snapshotWaitTimeoutMs,
      onMessage: d.onMessage,
      onError: d.onError,
      onDone: d.onDone
    });
  }
}

export let assistantRequestService = Service.create(
  'assistantRequestService',
  () => new AssistantRequestServiceImpl()
).build();
