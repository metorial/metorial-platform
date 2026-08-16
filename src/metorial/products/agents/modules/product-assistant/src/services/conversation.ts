import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, ProductAssistantConversation, Project, ResourceActor } from '@metorial/db';
import { db, ID, Prisma, withTransaction } from '@metorial/db';
import { resourceActorPresentationInclude } from '@metorial/module-resource-tenant';
import { getAssistantDefinition } from '../lib/definitions/assistantDefinition';
import { resolveAssistantConversationInput } from '../lib/definitions/conversationInput';
import type { State } from '../types';
import type { AvailableProductAssistant } from './assistant';
import { productAssistantService } from './assistant';
import {
  productAssistantConversationParticipantInclude,
  productAssistantConversationParticipantService
} from './participant';

export let productAssistantConversationInclude = {
  assistant: {
    include: {
      implementation: true
    }
  },
  assistantInstance: true,
  createdByResourceActor: {
    include: resourceActorPresentationInclude
  },
  instance: true,
  project: true,
  rootMessage: true,
  assistantConversationParticipants: {
    include: productAssistantConversationParticipantInclude
  }
} satisfies Prisma.ProductAssistantConversationInclude;

export type ProductAssistantConversationWithRelations =
  Prisma.ProductAssistantConversationGetPayload<{
    include: typeof productAssistantConversationInclude;
  }>;

export type ProductAssistantConversationWithAssistant =
  ProductAssistantConversationWithRelations & {
    availableAssistant: AvailableProductAssistant;
  };

let emptySerializedMessage = {
  b: 'ai-sdk-1',
  messages: []
} satisfies PrismaJson.ProductAssistantMessageSerializedContent;

let hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

let toNullableJson = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;

  return value as Prisma.InputJsonValue;
};

class ProductAssistantConversationServiceImpl {
  private async enrichConversations(d: {
    project: Project;
    conversations: ProductAssistantConversationWithRelations[];
  }): Promise<ProductAssistantConversationWithAssistant[]> {
    let assistants = await productAssistantService.getMany({
      project: d.project,
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
    project: Project;
    conversation: ProductAssistantConversationWithRelations;
  }) {
    return (
      await this.enrichConversations({
        project: d.project,
        conversations: [d.conversation]
      })
    )[0]!;
  }

  private ensureScope(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
  }) {
    productAssistantConversationParticipantService.assertProjectInstanceScope(d);
  }

  private conversationWhere(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    conversationId?: string;
    assistantId?: string;
    assistantIds?: string[];
  }) {
    return {
      projectOid: d.project.oid,
      instanceOid: d.instance.oid,
      id: d.conversationId,
      ...productAssistantConversationParticipantService.participantAccessWhere({
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
    } satisfies Prisma.ProductAssistantConversationWhereInput;
  }

  async getAssistantConversationById(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    conversationId: string;
  }) {
    this.ensureScope(d);

    let conversation = await db.productAssistantConversation.findFirst({
      where: this.conversationWhere(d),
      include: productAssistantConversationInclude
    });
    if (!conversation) {
      throw new ServiceError(notFoundError('assistant_conversation', d.conversationId));
    }

    return await this.enrichConversation({
      project: d.project,
      conversation
    });
  }

  async listAssistantConversations(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    assistantIds?: string[];
  }) {
    this.ensureScope(d);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        this.enrichConversations({
          project: d.project,
          conversations: await db.productAssistantConversation.findMany({
            ...opts,
            where: this.conversationWhere(d),
            include: productAssistantConversationInclude
          })
        })
      )
    );
  }

  async createAssistantConversation(d: {
    project: Project;
    instance: Instance;
    actor: ResourceActor;
    input: {
      assistantId: string;
      title?: string | null;
      input?: unknown;
    };
  }) {
    this.ensureScope(d);

    let assistant = await productAssistantService.get({
      project: d.project,
      assistantId: d.input.assistantId
    });
    let assistantInstance = await productAssistantService.getOrCreateAssistantInstance({
      assistant,
      project: d.project
    });
    if (!assistant.defaultModel) {
      throw new ServiceError(notFoundError('model', assistant.id));
    }
    let defaultModel = assistant.defaultModel;
    let definition = await getAssistantDefinition(assistant.implementation.slug);
    let conversationInput = await resolveAssistantConversationInput({
      project: d.project,
      instance: d.instance,
      actor: d.actor,
      assistant,
      assistantInstance,
      assistantImplementation: definition.implementation,
      rawInput: d.input.input,
      rawInputProvided: hasOwn(d.input, 'input')
    });

    return await withTransaction(async tx => {
      let rootMessage = await tx.productAssistantMessage.create({
        data: {
          id: await ID.generateId('productAssistantMessage'),
          type: 'root',
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          state: { items: [] } satisfies State,
          serialized: emptySerializedMessage
        }
      });

      let conversation = await tx.productAssistantConversation.create({
        data: {
          id: await ID.generateId('productAssistantConversation'),
          title: d.input.title,
          input: toNullableJson(conversationInput),
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          createdByResourceActorOid: d.actor.oid,
          rootMessageOid: rootMessage.oid,
          items: {
            create: {
              id: await ID.generateId('productAssistantConversationItem'),
              messageOid: rootMessage.oid
            }
          },
          assistantConversationParticipants: {
            create: {
              id: await ID.generateId('productAssistantConversationParticipant'),
              resourceActorOid: d.actor.oid
            }
          }
        },
        include: productAssistantConversationInclude
      });

      let request = await tx.productAssistantRequest.create({
        data: {
          id: await ID.generateId('productAssistantRequest'),
          status: 'completed',
          conversationOid: conversation.oid,
          assistantOid: assistant.oid,
          assistantInstanceOid: assistantInstance.oid,
          modelOid: defaultModel.oid,
          messageOid: rootMessage.oid,
          historySize: 0,
          resourceActorOid: d.actor.oid
        }
      });

      await tx.productAssistantMessage.update({
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
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    conversation: ProductAssistantConversation;
    input: {
      title?: string | null;
    };
  }) {
    this.ensureScope(d);
    await productAssistantConversationParticipantService.assertConversationAccess({
      project: d.project,
      instance: d.instance,
      conversation: d.conversation,
      actor: d.actor
    });

    let conversation = await db.productAssistantConversation.update({
      where: {
        oid: d.conversation.oid
      },
      data: {
        title: d.input.title
      },
      include: productAssistantConversationInclude
    });

    return await this.enrichConversation({
      project: d.project,
      conversation
    });
  }
}

export let productAssistantConversationService = Service.create(
  'productAssistantConversationService',
  () => new ProductAssistantConversationServiceImpl()
).build();
