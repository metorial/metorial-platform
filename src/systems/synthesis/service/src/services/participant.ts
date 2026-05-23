import { notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { Prisma, db } from '../db';
import type {
  AssistantConversation,
  AssistantConversationParticipant,
  Environment,
  Tenant,
  TenantActor
} from '../db';
import { getId } from '../id';

type DbClient = typeof db | Prisma.TransactionClient;

export let assistantConversationParticipantInclude = {
  conversation: true,
  tenantActor: true
} satisfies Prisma.AssistantConversationParticipantInclude;

export type AssistantConversationParticipantWithRelations =
  Prisma.AssistantConversationParticipantGetPayload<{
    include: typeof assistantConversationParticipantInclude;
  }>;

class AssistantConversationParticipantServiceImpl {
  private getClient(client?: DbClient) {
    return client ?? db;
  }

  assertTenantEnvironmentScope(d: {
    tenant: Tenant;
    environment: Environment;
    actor?: TenantActor | null;
  }) {
    if (d.environment.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('environment', d.environment.id));
    }

    if (d.actor && d.actor.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('tenant_actor', d.actor.id));
    }
  }

  participantAccessWhere(d: { actor?: TenantActor | null }) {
    if (!d.actor) return {};

    return {
      OR: [
        {
          createdByTenantActorOid: d.actor.oid
        },
        {
          assistantConversationParticipants: {
            some: {
              tenantActorOid: d.actor.oid
            }
          }
        }
      ]
    } satisfies Prisma.AssistantConversationWhereInput;
  }

  async hasConversationAccess(d: {
    tenant: Tenant;
    environment: Environment;
    conversation: Pick<
      AssistantConversation,
      'oid' | 'id' | 'tenantOid' | 'environmentOid' | 'createdByTenantActorOid'
    >;
    actor?: TenantActor | null;
    client?: DbClient;
  }) {
    this.assertTenantEnvironmentScope(d);

    if (
      d.conversation.tenantOid !== d.tenant.oid ||
      d.conversation.environmentOid !== d.environment.oid
    ) {
      return false;
    }

    if (!d.actor) return true;
    if (d.conversation.createdByTenantActorOid === d.actor.oid) return true;

    let client = this.getClient(d.client);
    let participant = await client.assistantConversationParticipant.findUnique({
      where: {
        conversationOid_tenantActorOid: {
          conversationOid: d.conversation.oid,
          tenantActorOid: d.actor.oid
        }
      }
    });

    return !!participant;
  }

  async assertConversationAccess(d: {
    tenant: Tenant;
    environment: Environment;
    conversation: Pick<
      AssistantConversation,
      'oid' | 'id' | 'tenantOid' | 'environmentOid' | 'createdByTenantActorOid'
    >;
    actor?: TenantActor | null;
    client?: DbClient;
  }) {
    let hasAccess = await this.hasConversationAccess(d);
    if (!hasAccess) {
      throw new ServiceError(notFoundError('assistant_conversation', d.conversation.id));
    }
  }

  async ensureConversationParticipant(d: {
    conversation: Pick<AssistantConversation, 'oid'>;
    actor: TenantActor;
    client?: DbClient;
  }): Promise<AssistantConversationParticipant> {
    let client = this.getClient(d.client);

    return await client.assistantConversationParticipant.upsert({
      where: {
        conversationOid_tenantActorOid: {
          conversationOid: d.conversation.oid,
          tenantActorOid: d.actor.oid
        }
      },
      update: {},
      create: {
        ...getId('assistantConversationParticipant'),
        conversationOid: d.conversation.oid,
        tenantActorOid: d.actor.oid
      }
    });
  }
}

export let assistantConversationParticipantService = Service.create(
  'assistantConversationParticipantService',
  () => new AssistantConversationParticipantServiceImpl()
).build();
