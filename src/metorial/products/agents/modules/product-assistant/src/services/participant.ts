import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  ProductAssistantConversation,
  ProductAssistantConversationParticipant,
  ResourceActor,
  ResourceGroup,
  ResourceTenant
} from '@metorial/db';
import { db, ID, Prisma } from '@metorial/db';

type DbClient = typeof db | Prisma.TransactionClient;

export let productAssistantConversationParticipantInclude = {
  conversation: true,
  resourceActor: true
} satisfies Prisma.ProductAssistantConversationParticipantInclude;

export type ProductAssistantConversationParticipantWithRelations =
  Prisma.ProductAssistantConversationParticipantGetPayload<{
    include: typeof productAssistantConversationParticipantInclude;
  }>;

class ProductAssistantConversationParticipantServiceImpl {
  private getClient(client?: DbClient) {
    return client ?? db;
  }

  assertTenantEnvironmentScope(d: {
    tenant: ResourceTenant;
    environment: ResourceGroup;
    actor?: ResourceActor | null;
  }) {
    if (d.environment.resourceTenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('environment', d.environment.id));
    }

    if (d.actor && d.actor.resourceTenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('tenant_actor', d.actor.id));
    }
  }

  participantAccessWhere(d: { actor?: ResourceActor | null }) {
    if (!d.actor) return {};

    return {
      OR: [
        {
          createdByResourceActorOid: d.actor.oid
        },
        {
          assistantConversationParticipants: {
            some: {
              resourceActorOid: d.actor.oid
            }
          }
        }
      ]
    } satisfies Prisma.ProductAssistantConversationWhereInput;
  }

  async hasConversationAccess(d: {
    tenant: ResourceTenant;
    environment: ResourceGroup;
    conversation: Pick<
      ProductAssistantConversation,
      'oid' | 'id' | 'resourceTenantOid' | 'resourceGroupOid' | 'createdByResourceActorOid'
    >;
    actor?: ResourceActor | null;
    client?: DbClient;
  }) {
    this.assertTenantEnvironmentScope(d);

    if (
      d.conversation.resourceTenantOid !== d.tenant.oid ||
      d.conversation.resourceGroupOid !== d.environment.oid
    ) {
      return false;
    }

    if (!d.actor) return true;
    if (d.conversation.createdByResourceActorOid === d.actor.oid) return true;

    let client = this.getClient(d.client);
    let participant = await client.productAssistantConversationParticipant.findUnique({
      where: {
        conversationOid_resourceActorOid: {
          conversationOid: d.conversation.oid,
          resourceActorOid: d.actor.oid
        }
      }
    });

    return !!participant;
  }

  async assertConversationAccess(d: {
    tenant: ResourceTenant;
    environment: ResourceGroup;
    conversation: Pick<
      ProductAssistantConversation,
      'oid' | 'id' | 'resourceTenantOid' | 'resourceGroupOid' | 'createdByResourceActorOid'
    >;
    actor?: ResourceActor | null;
    client?: DbClient;
  }) {
    let hasAccess = await this.hasConversationAccess(d);
    if (!hasAccess) {
      throw new ServiceError(notFoundError('assistant_conversation', d.conversation.id));
    }
  }

  async ensureConversationParticipant(d: {
    conversation: Pick<ProductAssistantConversation, 'oid'>;
    actor: ResourceActor;
    client?: DbClient;
  }): Promise<ProductAssistantConversationParticipant> {
    let client = this.getClient(d.client);

    return await client.productAssistantConversationParticipant.upsert({
      where: {
        conversationOid_resourceActorOid: {
          conversationOid: d.conversation.oid,
          resourceActorOid: d.actor.oid
        }
      },
      update: {},
      create: {
        id: await ID.generateId('productAssistantConversationParticipant'),
        conversationOid: d.conversation.oid,
        resourceActorOid: d.actor.oid
      }
    });
  }
}

export let productAssistantConversationParticipantService = Service.create(
  'productAssistantConversationParticipantService',
  () => new ProductAssistantConversationParticipantServiceImpl()
).build();
