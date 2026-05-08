import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  AssistantConversation,
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Prisma,
  withTransaction
} from '@metorial/db';
import { State } from '../proto/types';
import { assistantService, AvailableAssistant } from './assistant';

export let assistantConversationInclude = {
  assistant: {
    include: {
      implementation: true
    }
  },
  assistantInstance: {
    include: {
      organizationActor: true
    }
  },
  createdByActor: true,
  instance: true,
  organization: true,
  rootMessage: true
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

class AssistantConversationServiceImpl {
  private async enrichConversations(d: {
    organization: Organization;
    conversations: AssistantConversationWithRelations[];
  }): Promise<AssistantConversationWithAssistant[]> {
    let assistantsById = await assistantService.getAvailableAssistantsByIds({
      organization: d.organization,
      assistantIds: d.conversations.map(conversation => conversation.assistant.id)
    });

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
    organization: Organization;
    conversation: AssistantConversationWithRelations;
  }) {
    return (
      await this.enrichConversations({
        organization: d.organization,
        conversations: [d.conversation]
      })
    )[0];
  }

  private ensureScope(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
  }) {
    if (d.instance.organizationOid !== d.organization.oid) {
      throw new ServiceError(notFoundError('instance', d.instance.id));
    }

    if (d.actor.organizationOid !== d.organization.oid) {
      throw new ServiceError(notFoundError('organization_actor', d.actor.id));
    }
  }

  private conversationWhere(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversationId?: string;
    assistantId?: string;
    assistantIds?: string[];
  }) {
    return {
      organizationOid: d.organization.oid,
      instanceOid: d.instance.oid,
      createdByActorOid: d.actor.oid,
      id: d.conversationId,
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
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversationId: string;
    assistantId?: string;
  }) {
    this.ensureScope(d);

    let conversation = await db.assistantConversation.findFirst({
      where: this.conversationWhere(d),
      include: assistantConversationInclude
    });
    if (!conversation)
      throw new ServiceError(notFoundError('assistant_conversation', d.conversationId));

    return await this.enrichConversation({
      organization: d.organization,
      conversation
    });
  }

  async listAssistantConversations(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    assistantIds?: string[];
  }) {
    this.ensureScope(d);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        this.enrichConversations({
          organization: d.organization,
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
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    context?: Context;
    input: {
      assistantId: string;
      title?: string | null;
    };
  }) {
    this.ensureScope(d);

    let assistant = await assistantService.getAvailableAssistant({
      organization: d.organization,
      assistantId: d.input.assistantId
    });
    let assistantInstance = await assistantService.getOrCreateAssistantInstance({
      assistant,
      organization: d.organization,
      context: d.context,
      performedBy: d.actor
    });
    if (!assistant.defaultModel) {
      throw new ServiceError(notFoundError('assistant_model', assistant.id));
    }
    let defaultModel = assistant.defaultModel;

    return await withTransaction(async db => {
      let rootMessage = await db.assistantMessage.create({
        data: {
          id: await ID.generateId('assistantMessage'),
          type: 'root',
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          state: { items: [] } satisfies State,
          serialized: emptySerializedMessage
        }
      });

      let conversation = await db.assistantConversation.create({
        data: {
          id: await ID.generateId('assistantConversation'),
          title: d.input.title,
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          instanceOid: d.instance.oid,
          organizationOid: d.organization.oid,
          createdByActorOid: d.actor.oid,
          rootMessageOid: rootMessage.oid,
          items: {
            create: {
              id: await ID.generateId('assistantConversationItem'),
              messageOid: rootMessage.oid
            }
          }
        },
        include: assistantConversationInclude
      });

      let request = await db.assistantRequest.create({
        data: {
          id: await ID.generateId('assistantRequest'),
          status: 'completed',
          conversationOid: conversation.oid,
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          modelOid: defaultModel.oid,
          messageOid: rootMessage.oid,
          historySize: 0,
          actorOid: d.actor.oid
        }
      });

      await db.assistantMessage.update({
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
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversation: AssistantConversation;
    context?: Context;
    input: {
      title?: string | null;
    };
  }) {
    this.ensureScope(d);

    if (
      d.conversation.organizationOid !== d.organization.oid ||
      d.conversation.instanceOid !== d.instance.oid ||
      d.conversation.createdByActorOid !== d.actor.oid
    ) {
      throw new ServiceError(notFoundError('assistant_conversation', d.conversation.id));
    }

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
      organization: d.organization,
      conversation
    });
  }
}

export let assistantConversationService = Service.create(
  'assistantConversationService',
  () => new AssistantConversationServiceImpl()
).build();
