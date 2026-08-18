import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Instance,
  ProductAssistantConversation,
  ProductAssistantConversationParticipant,
  Project,
  ResourceActor
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
  assertProjectInstanceScope(d: {
    project: Project;
    instance: Instance;
    actor?: ResourceActor | null;
  }) {
    if (d.instance.projectOid !== d.project.oid) {
      throw new ServiceError(notFoundError('instance', d.instance.id));
    }

    if (d.actor && d.actor.projectOid !== d.project.oid) {
      throw new ServiceError(notFoundError('actor', d.actor.id));
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
    project: Project;
    instance: Instance;
    conversation: Pick<
      ProductAssistantConversation,
      'oid' | 'id' | 'projectOid' | 'instanceOid' | 'createdByResourceActorOid'
    >;
    actor?: ResourceActor | null;
    client?: DbClient;
  }) {
    this.assertProjectInstanceScope(d);

    if (
      d.conversation.projectOid !== d.project.oid ||
      d.conversation.instanceOid !== d.instance.oid
    ) {
      return false;
    }

    if (!d.actor) return true;
    if (d.conversation.createdByResourceActorOid === d.actor.oid) return true;

    let where = {
      conversationOid_resourceActorOid: {
        conversationOid: d.conversation.oid,
        resourceActorOid: d.actor.oid
      }
    };
    if (d.client) {
      let participant = await (
        d.client as Prisma.TransactionClient
      ).productAssistantConversationParticipant.findUnique({ where });
      return !!participant;
    }

    let participant = await db.productAssistantConversationParticipant.findUnique({ where });
    return !!participant;
  }

  async assertConversationAccess(d: {
    project: Project;
    instance: Instance;
    conversation: Pick<
      ProductAssistantConversation,
      'oid' | 'id' | 'projectOid' | 'instanceOid' | 'createdByResourceActorOid'
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
    let input = {
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
    };

    if (d.client) {
      return await (
        d.client as Prisma.TransactionClient
      ).productAssistantConversationParticipant.upsert(input);
    }

    return await db.productAssistantConversationParticipant.upsert(input);
  }
}

export let productAssistantConversationParticipantService = Service.create(
  'productAssistantConversationParticipantService',
  () => new ProductAssistantConversationParticipantServiceImpl()
).build();
