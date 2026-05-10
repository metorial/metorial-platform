import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  Prisma,
  db
} from '../db';
import type { AssistantConversation, Environment, Tenant, TenantActor } from '../db';
import { assistantConversationParticipantService } from './participant';

export let assistantMessageInclude = {
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
      tenantActor: true
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
  private async ensureScope(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    conversation: AssistantConversation;
  }) {
    await assistantConversationParticipantService.assertConversationAccess({
      tenant: d.tenant,
      environment: d.environment,
      conversation: d.conversation,
      actor: d.actor
    });
  }

  private conversationItemWhere(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    conversation: AssistantConversation;
    messageId?: string;
  }) {
    return {
      conversation: {
        oid: d.conversation.oid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        ...assistantConversationParticipantService.participantAccessWhere({
          actor: d.actor
        })
      },
      message: {
        id: d.messageId
      }
    } satisfies Prisma.AssistantConversationItemWhereInput;
  }

  async getAssistantMessageById(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    conversation: AssistantConversation;
    messageId: string;
  }) {
    await this.ensureScope(d);

    let item = await db.assistantConversationItem.findFirst({
      where: this.conversationItemWhere(d),
      include: assistantConversationItemInclude
    });
    if (!item) throw new ServiceError(notFoundError('assistant_message', d.messageId));

    return item;
  }

  async listAssistantMessages(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
    conversation: AssistantConversation;
  }) {
    await this.ensureScope(d);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
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
