import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Instance,
  ProductAssistantConversation,
  Project,
  ResourceActor
} from '@metorial/db';
import { Prisma } from '@metorial/db';

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
    actor: ResourceActor;
  }) {
    if (d.instance.projectOid !== d.project.oid) {
      throw new ServiceError(notFoundError('instance', d.instance.id));
    }

    if (d.actor.projectOid !== d.project.oid) {
      throw new ServiceError(notFoundError('actor', d.actor.id));
    }
  }

  ownerAccessWhere(d: { actor: ResourceActor }) {
    return {
      createdByResourceActorOid: d.actor.oid
    } satisfies Prisma.ProductAssistantConversationWhereInput;
  }

  hasConversationAccess(d: {
    project: Project;
    instance: Instance;
    conversation: Pick<
      ProductAssistantConversation,
      'projectOid' | 'instanceOid' | 'createdByResourceActorOid'
    >;
    actor: ResourceActor;
  }) {
    this.assertProjectInstanceScope(d);

    return (
      d.conversation.projectOid === d.project.oid &&
      d.conversation.instanceOid === d.instance.oid &&
      d.conversation.createdByResourceActorOid === d.actor.oid
    );
  }

  assertConversationAccess(d: {
    project: Project;
    instance: Instance;
    conversation: Pick<
      ProductAssistantConversation,
      'id' | 'projectOid' | 'instanceOid' | 'createdByResourceActorOid'
    >;
    actor: ResourceActor;
  }) {
    if (!this.hasConversationAccess(d)) {
      throw new ServiceError(notFoundError('assistant_conversation', d.conversation.id));
    }
  }
}

export let productAssistantConversationParticipantService = Service.create(
  'productAssistantConversationParticipantService',
  () => new ProductAssistantConversationParticipantServiceImpl()
).build();
