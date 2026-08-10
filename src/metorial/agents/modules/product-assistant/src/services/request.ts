import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  ProductAssistantModel as PersistedModel,
  ProductAssistantConversation,
  ResourceActor,
  ResourceGroup,
  ResourceTenant
} from '@metorial/db';
import { db, Prisma, withTransaction } from '@metorial/db';
import { resolveInstanceResourceScope } from '@metorial/module-resource-tenant';
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
import { productAssistantConversationItemInclude } from './message';
import { productAssistantConversationParticipantService } from './participant';

let serializeInputMessage = (
  input: InputMessage
): PrismaJson.ProductAssistantMessageSerializedContent => ({
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

export let productAssistantRequestInclude = {
  resourceActor: true,
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
} satisfies Prisma.ProductAssistantRequestInclude;

export type ProductAssistantRequestWithRelations = Prisma.ProductAssistantRequestGetPayload<{
  include: typeof productAssistantRequestInclude;
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

class ProductAssistantRequestServiceImpl {
  private async ensureScope(d: {
    tenant: ResourceTenant;
    environment: ResourceGroup;
    actor: ResourceActor;
    conversation: ProductAssistantConversation;
    allowAllActors?: boolean;
    client?: typeof db | Prisma.TransactionClient;
  }) {
    let hasAccess = await productAssistantConversationParticipantService.hasConversationAccess(
      {
        tenant: d.tenant,
        environment: d.environment,
        conversation: d.conversation,
        actor: d.actor,
        client: d.client
      }
    );

    if (hasAccess) return;

    if (d.allowAllActors) {
      await productAssistantConversationParticipantService.ensureConversationParticipant({
        conversation: d.conversation,
        actor: d.actor,
        client: d.client
      });
      return;
    }

    throw new ServiceError(notFoundError('assistant_conversation', d.conversation.id));
  }

  private async resolveParentMessage(d: {
    conversation: ProductAssistantConversation;
    parentMessageId?: string;
  }) {
    let item = await db.productAssistantConversationItem.findFirst({
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
    let request = await db.productAssistantRequest.findFirst({
      where: {
        id: d.requestId
      },
      include: productAssistantRequestInclude
    });
    if (!request) {
      throw new ServiceError(notFoundError('assistant_request', d.requestId));
    }

    return request;
  }

  async lookupAssistantRequest(d: { requestId: string }) {
    let request = await db.productAssistantRequest.findFirst({
      where: {
        id: d.requestId
      },
      include: {
        ...productAssistantRequestInclude,
        conversation: {
          include: {
            resourceTenant: true,
            resourceGroup: true
          }
        }
      }
    });
    if (!request) {
      throw new ServiceError(notFoundError('assistant_request', d.requestId));
    }

    let { instanceOid } = await resolveInstanceResourceScope({
      resourceTenant: request.conversation.resourceTenant,
      resourceGroup: request.conversation.resourceGroup
    });

    let instance = await db.instance.findUniqueOrThrow({
      where: {
        oid: instanceOid
      },
      include: {
        organization: true,
        project: true
      }
    });

    return {
      request,
      instance,
      organization: instance.organization
    };
  }

  private async waitForAssistantRequestRunId(d: {
    request: ProductAssistantRequestWithRelations;
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

      let latest = await db.productAssistantRequest.findUnique({
        where: {
          oid: d.request.oid
        },
        include: productAssistantRequestInclude
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
    tenant: ResourceTenant;
    environment: ResourceGroup;
    actor: ResourceActor;
    conversation: ProductAssistantConversation;
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

    let assistant = await db.productAssistant.findUnique({
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

      let userMessage = await tx.productAssistantMessage.create({
        data: {
          ...getId('productAssistantMessage'),
          type: 'user',
          assistantOid: d.conversation.assistantOid,
          assistantInstanceOid: d.conversation.assistantInstanceOid,
          parentMessageOid: parentMessage.oid,
          modelOid: model.oid,
          state: inputMessageState(d.input.message),
          serialized: serializeInputMessage(d.input.message)
        }
      });

      let request = await tx.productAssistantRequest.create({
        data: {
          ...getId('productAssistantRequest'),
          status: 'pending',
          conversationOid: d.conversation.oid,
          assistantOid: d.conversation.assistantOid,
          assistantInstanceOid: d.conversation.assistantInstanceOid,
          modelOid: model.oid,
          messageOid: userMessage.oid,
          historySize: 100,
          resourceActorOid: d.actor.oid
        }
      });

      userMessage = await tx.productAssistantMessage.update({
        where: {
          oid: userMessage.oid
        },
        data: {
          requestOid: request.oid
        }
      });

      let item = await tx.productAssistantConversationItem.create({
        data: {
          ...getId('productAssistantConversationItem'),
          conversationOid: d.conversation.oid,
          messageOid: userMessage.oid
        },
        include: productAssistantConversationItemInclude
      });

      if (shouldGenerateTitle) {
        let userMessageCount = await tx.productAssistantConversationItem.count({
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
    tenant: ResourceTenant;
    environment: ResourceGroup;
    actor: ResourceActor;
    conversation: ProductAssistantConversation;
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

    let item = await db.productAssistantConversationItem.findFirst({
      where: {
        conversationOid: d.conversation.oid,
        message: {
          id: d.input.messageId
        }
      },
      include: productAssistantConversationItemInclude
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
      getHandoffToolCalls(applied.state).map(({ toolName, call }) => [
        call.id,
        { toolName, call }
      ])
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
      await tx.productAssistantMessage.update({
        where: {
          oid: message.oid
        },
        data: {
          status: shouldResume ? 'pending' : 'waiting_for_user',
          state: applied.state
        }
      });

      await tx.productAssistantRequest.update({
        where: {
          oid: message.request!.oid
        },
        data: {
          status: shouldResume ? 'pending' : 'waiting_for_user'
        }
      });

      if (message.run) {
        await tx.productAssistantModelRun.update({
          where: {
            oid: message.run.oid
          },
          data: {
            status: shouldResume ? 'pending' : 'waiting_for_user'
          }
        });
      }

      return await tx.productAssistantConversationItem.findUniqueOrThrow({
        where: {
          oid: item.oid
        },
        include: productAssistantConversationItemInclude
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

export let productAssistantRequestService = Service.create(
  'productAssistantRequestService',
  () => new ProductAssistantRequestServiceImpl()
).build();
