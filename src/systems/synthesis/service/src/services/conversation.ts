import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AssistantConversation, Environment, Tenant, TenantActor } from '../db';
import { db, Prisma, withTransaction } from '../db';
import { getId } from '../id';
import { getAssistantDefinition } from '../lib/definitions/assistantDefinition';
import { resolveAssistantConversationInput } from '../lib/definitions/conversationInput';
import type { State } from '../types';
import type { AvailableAssistant } from './assistant';
import { assistantService } from './assistant';
import {
  assistantConversationParticipantInclude,
  assistantConversationParticipantService
} from './participant';

export let assistantConversationInclude = {
  assistant: {
    include: {
      implementation: true
    }
  },
  assistantInstance: true,
  createdByTenantActor: true,
  environment: true,
  tenant: true,
  rootMessage: true,
  assistantConversationParticipants: {
    include: assistantConversationParticipantInclude
  }
} satisfies Prisma.AssistantConversationInclude;

export type AssistantConversationWithRelations = Prisma.AssistantConversationGetPayload<{
  include: typeof assistantConversationInclude;
}>;

export type AssistantConversationWithAssistant = AssistantConversationWithRelations & {
  availableAssistant: AvailableAssistant;
};

let emptySerializedMessage = {
  b: 'ai-sdk-1',
  messages: []
} satisfies PrismaJson.AssistantMessageSerializedContent;

let hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

let toNullableJson = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;

  return value as Prisma.InputJsonValue;
};

class AssistantConversationServiceImpl {
  private async enrichConversations(d: {
    tenant: Tenant;
    conversations: AssistantConversationWithRelations[];
  }): Promise<AssistantConversationWithAssistant[]> {
    let assistants = await assistantService.getMany({
      tenant: d.tenant,
      assistantIds: d.conversations.map(conversation => conversation.assistant.id)
    });
    let assistantsById = new Map(assistants.map(assistant => [assistant.id, assistant]));

    return d.conversations.map(conversation => {
      let availableAssistant = assistantsById.get(conversation.assistant.id);
      if (!availableAssistant) {
        throw new ServiceError(notFoundError('assistant', conversation.assistant.id));
      }

      return {
        ...conversation,
        availableAssistant
      };
    });
  }

  private async enrichConversation(d: {
    tenant: Tenant;
    conversation: AssistantConversationWithRelations;
  }) {
    return (
      await this.enrichConversations({
        tenant: d.tenant,
        conversations: [d.conversation]
      })
    )[0]!;
  }

  private ensureScope(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
  }) {
    assistantConversationParticipantService.assertTenantEnvironmentScope(d);
  }

  private conversationWhere(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    conversationId?: string;
    assistantId?: string;
    assistantIds?: string[];
  }) {
    return {
      tenantOid: d.tenant.oid,
      environmentOid: d.environment.oid,
      id: d.conversationId,
      ...assistantConversationParticipantService.participantAccessWhere({
        actor: d.actor
      }),
      assistant:
        d.assistantId || d.assistantIds
          ? {
              OR: [
                ...(d.assistantId
                  ? [
                      { id: d.assistantId },
                      { slug: d.assistantId },
                      { systemIdentifier: d.assistantId }
                    ]
                  : []),
                ...(d.assistantIds
                  ? [
                      { id: { in: d.assistantIds } },
                      { slug: { in: d.assistantIds } },
                      { systemIdentifier: { in: d.assistantIds } }
                    ]
                  : [])
              ]
            }
          : undefined
    } satisfies Prisma.AssistantConversationWhereInput;
  }

  async getAssistantConversationById(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    conversationId: string;
  }) {
    this.ensureScope(d);

    let conversation = await db.assistantConversation.findFirst({
      where: this.conversationWhere(d),
      include: assistantConversationInclude
    });
    if (!conversation) {
      throw new ServiceError(notFoundError('assistant_conversation', d.conversationId));
    }

    return await this.enrichConversation({
      tenant: d.tenant,
      conversation
    });
  }

  async listAssistantConversations(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    assistantIds?: string[];
  }) {
    this.ensureScope(d);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        this.enrichConversations({
          tenant: d.tenant,
          conversations: await db.assistantConversation.findMany({
            ...opts,
            where: this.conversationWhere(d),
            include: assistantConversationInclude
          })
        })
      )
    );
  }

  async createAssistantConversation(d: {
    tenant: Tenant;
    environment: Environment;
    actor: TenantActor;
    input: {
      assistantId: string;
      title?: string | null;
      input?: unknown;
    };
  }) {
    this.ensureScope(d);

    let assistant = await assistantService.get({
      tenant: d.tenant,
      assistantId: d.input.assistantId
    });
    let assistantInstance = await assistantService.getOrCreateAssistantInstance({
      assistant,
      tenant: d.tenant
    });
    if (!assistant.defaultModel) {
      throw new ServiceError(notFoundError('model', assistant.id));
    }
    let defaultModel = assistant.defaultModel;
    let definition = await getAssistantDefinition(assistant.implementation.slug);
    let conversationInput = await resolveAssistantConversationInput({
      tenant: d.tenant,
      environment: d.environment,
      actor: d.actor,
      assistant,
      assistantInstance,
      assistantImplementation: definition.implementation,
      rawInput: d.input.input,
      rawInputProvided: hasOwn(d.input, 'input')
    });

    return await withTransaction(async tx => {
      let rootMessage = await tx.assistantMessage.create({
        data: {
          ...getId('assistantMessage'),
          type: 'root',
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          state: { items: [] } satisfies State,
          serialized: emptySerializedMessage
        }
      });

      let conversation = await tx.assistantConversation.create({
        data: {
          ...getId('assistantConversation'),
          title: d.input.title,
          input: toNullableJson(conversationInput),
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          createdByTenantActorOid: d.actor.oid,
          rootMessageOid: rootMessage.oid,
          items: {
            create: {
              ...getId('assistantConversationItem'),
              messageOid: rootMessage.oid
            }
          },
          assistantConversationParticipants: {
            create: {
              ...getId('assistantConversationParticipant'),
              tenantActorOid: d.actor.oid
            }
          }
        },
        include: assistantConversationInclude
      });

      let request = await tx.assistantRequest.create({
        data: {
          ...getId('assistantRequest'),
          status: 'completed',
          conversationOid: conversation.oid,
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          modelOid: defaultModel.oid,
          messageOid: rootMessage.oid,
          historySize: 0,
          tenantActorOid: d.actor.oid
        }
      });

      await tx.assistantMessage.update({
        where: {
          oid: rootMessage.oid
        },
        data: {
          requestOid: request.oid
        }
      });

      return {
        ...conversation,
        availableAssistant: assistant
      };
    });
  }

  async updateAssistantConversation(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    conversation: AssistantConversation;
    input: {
      title?: string | null;
    };
  }) {
    this.ensureScope(d);
    await assistantConversationParticipantService.assertConversationAccess({
      tenant: d.tenant,
      environment: d.environment,
      conversation: d.conversation,
      actor: d.actor
    });

    let conversation = await db.assistantConversation.update({
      where: {
        oid: d.conversation.oid
      },
      data: {
        title: d.input.title
      },
      include: assistantConversationInclude
    });

    return await this.enrichConversation({
      tenant: d.tenant,
      conversation
    });
  }
}

export let assistantConversationService = Service.create(
  'assistantConversationService',
  () => new AssistantConversationServiceImpl()
).build();
