import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  AssistantConversation,
  AssistantModel,
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Prisma,
  withTransaction
} from '@metorial/db';
import { assistants } from '../definitions/assistants';
import { Implementation } from '../lib/definitions';
import { AgentRunWireMessage } from '../lib/run/state';
import { listenToAssistantRunDeltas } from '../lib/run/redisDeltas';
import { InputMessage, State } from '../proto/types';
import { generateAssistantConversationTitleQueue } from '../queues/generateConversationTitle';
import { processAssistantRequestQueue } from '../queues/processRequest';
import { assistantConversationItemInclude } from './message';

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
        id: 'message:0',
        type: 'message',
        status: 'completed',
        message: {
          role: 'user',
          parts: input.parts
        }
      }
    ]
  }) satisfies State;

type AssistantDefinition = Awaited<(typeof assistants)[keyof typeof assistants]>;

export let assistantRequestInclude = {
  actor: true,
  conversation: true,
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

let chooseModel = (d: {
  implementation: Implementation;
  modelId?: string;
}): AssistantModel => {
  if (!d.modelId) return d.implementation.defaultModel._persisted;

  let model = d.implementation.availableModels.find(
    model =>
      model.slug == d.modelId ||
      model.name == d.modelId ||
      model._persisted.id == d.modelId ||
      model._persisted.slug == d.modelId
  );

  if (!model) throw new ServiceError(notFoundError('assistant_model', d.modelId));

  return model._persisted;
};

class AssistantRequestServiceImpl {
  private ensureScope(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversation: AssistantConversation;
  }) {
    if (
      d.conversation.organizationOid !== d.organization.oid ||
      d.conversation.instanceOid !== d.instance.oid ||
      d.conversation.createdByActorOid !== d.actor.oid
    ) {
      throw new ServiceError(notFoundError('assistant_conversation', d.conversation.id));
    }
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

  private async getScopedAssistantRequestById(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    requestId: string;
  }) {
    let request = await db.assistantRequest.findFirst({
      where: {
        id: d.requestId,
        conversation: {
          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid,
          createdByActorOid: d.actor.oid
        }
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

  async getAssistantRequestById(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    requestId: string;
  }) {
    return await this.getScopedAssistantRequestById(d);
  }

  async createAssistantRequest(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversation: AssistantConversation;
    context?: Context;
    input: {
      message: InputMessage;
      parentMessageId?: string;
      historySize?: number;
      modelId?: string;
    };
  }) {
    this.ensureScope(d);

    let parentMessage = await this.resolveParentMessage({
      conversation: d.conversation,
      parentMessageId: d.input.parentMessageId
    });
    let historySize = d.input.historySize ?? 100;
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
    let result = await withTransaction(async db => {
      let userMessage = await db.assistantMessage.create({
        data: {
          id: await ID.generateId('assistantMessage'),
          type: 'user',
          assistantOid: d.conversation.assistantOid,
          assistantInstanceOid: d.conversation.assistantInstanceOid,
          parentMessageOid: parentMessage.oid,
          modelOid: model.oid,
          state: inputMessageState(d.input.message),
          serialized: serializeInputMessage(d.input.message)
        }
      });

      let request = await db.assistantRequest.create({
        data: {
          id: await ID.generateId('assistantRequest'),
          status: 'pending',
          conversationOid: d.conversation.oid,
          assistantOid: d.conversation.assistantOid,
          assistantInstanceOid: d.conversation.assistantInstanceOid,
          modelOid: model.oid,
          messageOid: userMessage.oid,
          historySize,
          actorOid: d.actor.oid
        }
      });

      userMessage = await db.assistantMessage.update({
        where: {
          oid: userMessage.oid
        },
        data: {
          requestOid: request.oid
        }
      });

      let item = await db.assistantConversationItem.create({
        data: {
          id: await ID.generateId('assistantConversationItem'),
          conversationOid: d.conversation.oid,
          messageOid: userMessage.oid
        },
        include: assistantConversationItemInclude
      });

      if (shouldGenerateTitle) {
        let userMessageCount = await db.assistantConversationItem.count({
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

  async listenToAssistantRequestDeltas(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    requestId: string;
    signal?: AbortSignal;
    pollIntervalMs?: number;
    runWaitTimeoutMs?: number;
    snapshotWaitTimeoutMs?: number;
    onMessage: (message: AgentRunWireMessage) => void | Promise<void>;
    onError?: (error: Error) => void | Promise<void>;
  }) {
    let request = await this.getScopedAssistantRequestById(d);
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
      onError: d.onError
    });
  }
}

export let assistantRequestService = Service.create(
  'assistantRequestService',
  () => new AssistantRequestServiceImpl()
).build();
