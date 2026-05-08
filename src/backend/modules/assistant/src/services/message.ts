import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  AssistantConversation,
  db,
  Instance,
  Organization,
  OrganizationActor,
  Prisma
} from '@metorial/db';

export let assistantMessageInclude = {
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
  model: {
    include: {
      provider: true
    }
  },
  parentMessage: true,
  request: {
    include: {
      actor: true
    }
  },
  run: true
} satisfies Prisma.AssistantMessageInclude;

export type AssistantMessageWithRelations = Prisma.AssistantMessageGetPayload<{
  include: typeof assistantMessageInclude;
}>;

export let assistantConversationItemInclude = {
  message: {
    include: assistantMessageInclude
  },
  conversation: true
} satisfies Prisma.AssistantConversationItemInclude;

export type AssistantConversationItemWithMessage = Prisma.AssistantConversationItemGetPayload<{
  include: typeof assistantConversationItemInclude;
}>;

class AssistantMessageServiceImpl {
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

  private conversationItemWhere(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversation: AssistantConversation;
    messageId?: string;
  }) {
    return {
      conversation: {
        oid: d.conversation.oid,
        organizationOid: d.organization.oid,
        instanceOid: d.instance.oid,
        createdByActorOid: d.actor.oid
      },
      message: {
        id: d.messageId
      }
    } satisfies Prisma.AssistantConversationItemWhereInput;
  }

  async getAssistantMessageById(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversation: AssistantConversation;
    messageId: string;
  }) {
    this.ensureScope(d);

    let item = await db.assistantConversationItem.findFirst({
      where: this.conversationItemWhere(d),
      include: assistantConversationItemInclude
    });
    if (!item) throw new ServiceError(notFoundError('assistant_message', d.messageId));

    return item;
  }

  async listAssistantMessages(d: {
    organization: Organization;
    instance: Instance;
    actor: OrganizationActor;
    conversation: AssistantConversation;
  }) {
    this.ensureScope(d);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.assistantConversationItem.findMany({
            ...opts,
            where: this.conversationItemWhere(d),
            include: assistantConversationItemInclude,
            orderBy: {
              createdAt: 'asc'
            }
          })
      )
    );
  }
}

export let assistantMessageService = Service.create(
  'assistantMessageService',
  () => new AssistantMessageServiceImpl()
).build();
