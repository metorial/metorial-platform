import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, ProductAssistantConversation, Project, ResourceActor } from '@metorial/db';
import { db, Prisma } from '@metorial/db';
import { resourceActorPresentationInclude } from '@metorial/module-resource-tenant';
import { productAssistantConversationParticipantService } from './participant';

export let productAssistantMessageInclude = {
  assistant: {
    include: {
      implementation: true
    }
  },
  assistantInstance: true,
  model: {
    include: {
      provider: true
    }
  },
  parentMessage: true,
  request: {
    include: {
      resourceActor: {
        include: resourceActorPresentationInclude
      }
    }
  },
  run: true
} satisfies Prisma.ProductAssistantMessageInclude;

export type ProductAssistantMessageWithRelations = Prisma.ProductAssistantMessageGetPayload<{
  include: typeof productAssistantMessageInclude;
}>;

export let productAssistantConversationItemInclude = {
  message: {
    include: productAssistantMessageInclude
  },
  conversation: true
} satisfies Prisma.ProductAssistantConversationItemInclude;

export type ProductAssistantConversationItemWithMessage =
  Prisma.ProductAssistantConversationItemGetPayload<{
    include: typeof productAssistantConversationItemInclude;
  }>;

class ProductAssistantMessageServiceImpl {
  private async ensureScope(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    conversation: ProductAssistantConversation;
  }) {
    await productAssistantConversationParticipantService.assertConversationAccess({
      project: d.project,
      instance: d.instance,
      conversation: d.conversation,
      actor: d.actor
    });
  }

  private conversationItemWhere(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    conversation: ProductAssistantConversation;
    messageId?: string;
  }) {
    return {
      conversation: {
        oid: d.conversation.oid,
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        ...productAssistantConversationParticipantService.participantAccessWhere({
          actor: d.actor
        })
      },
      message: {
        id: d.messageId
      }
    } satisfies Prisma.ProductAssistantConversationItemWhereInput;
  }

  async getAssistantMessageById(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    conversation: ProductAssistantConversation;
    messageId: string;
  }) {
    await this.ensureScope(d);

    let item = await db.productAssistantConversationItem.findFirst({
      where: this.conversationItemWhere(d),
      include: productAssistantConversationItemInclude
    });
    if (!item) throw new ServiceError(notFoundError('assistant_message', d.messageId));

    return item;
  }

  async listAssistantMessages(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
    conversation: ProductAssistantConversation;
  }) {
    await this.ensureScope(d);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.productAssistantConversationItem.findMany({
            ...opts,
            where: this.conversationItemWhere(d),
            include: productAssistantConversationItemInclude,
            orderBy: {
              createdAt: 'asc'
            }
          })
      )
    );
  }
}

export let productAssistantMessageService = Service.create(
  'productAssistantMessageService',
  () => new ProductAssistantMessageServiceImpl()
).build();
