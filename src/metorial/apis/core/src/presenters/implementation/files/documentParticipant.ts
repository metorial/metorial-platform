import { v } from '@lowerdeck/validation';
import type { AssistantConversationWithAssistant } from '@metorial/module-assistant';
import type { ResourceActorPresentationRecord } from '@metorial/module-resource-tenant';
import type { PresenterContext } from '@metorial/presenter';
import { Presenter } from '@metorial/presenter';
import { documentParticipantType } from '../../types';
import { v1ConsumerPresenter } from '../consumer/consumer';
import { v1OrganizationActorPresenter } from '../organization/organizationActor';

export let documentParticipantActorSchema = v.object({
  type: v.enumOf(['organization_actor', 'consumer', 'unknown']),
  name: v.string(),
  image_url: v.nullable(v.string()),
  email: v.nullable(v.string()),
  organization_actor: v.nullable(v1OrganizationActorPresenter.schema),
  consumer: v.nullable(v1ConsumerPresenter.schema),
  resource_actor: v.nullable(
    v.object({
      id: v.string(),
      type: v.enumOf(['external', 'system']),
      name: v.string()
    })
  ),
  consumer_profile: v.nullable(
    v.object({
      id: v.string(),
      name: v.string(),
      status: v.enumOf(['active', 'deleted'])
    })
  ),
  organization_member: v.nullable(
    v.object({
      id: v.string(),
      status: v.enumOf(['active', 'deleted']),
      role: v.enumOf(['admin', 'member'])
    })
  )
});

export let presentDocumentParticipantActor = async (
  actor:
    | ResourceActorPresentationRecord
    | AssistantConversationWithAssistant['createdByActor'],
  opts: PresenterContext
) => {
  let actorRecord: any = actor;
  let isResourceActor = 'resourceTenantOid' in actorRecord;
  let resourceActor: any = isResourceActor ? actorRecord : null;
  let organizationActor = isResourceActor
    ? (resourceActor.organizationActor ?? null)
    : actorRecord.organizationActor;
  let consumerProfile = isResourceActor
    ? (resourceActor.consumerProfile ?? null)
    : null;
  let instanceConsumer = isResourceActor
    ? consumerProfile
      ? (consumerProfile.consumer.instanceConsumers.find(
          (consumer: any) => consumer.instanceOid == consumerProfile.instanceOid
        ) ?? null)
      : (resourceActor.consumer?.instanceConsumers
          .slice()
          .sort(
            (a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime()
          )[0] ?? null)
    : actorRecord.consumer;
  let organizationMember =
    organizationActor?.member ??
    consumerProfile?.organizationMember ??
    resourceActor?.consumer?.organizationMember ??
    null;

  let orgActor = organizationActor
    ? await v1OrganizationActorPresenter
        .present({ organizationActor }, opts)
        .run()
    : null;
  let consumer = instanceConsumer
    ? await v1ConsumerPresenter.present({ consumer: instanceConsumer }, opts).run()
    : null;

  return {
    type: organizationActor
      ? ('organization_actor' as const)
      : instanceConsumer
        ? ('consumer' as const)
        : ('unknown' as const),

    name: organizationActor?.name ?? instanceConsumer?.name ?? actor.name,
    image_url: orgActor?.image_url ?? consumer?.image_url ?? null,
    email: orgActor?.email ?? consumer?.email ?? null,
    organization_actor: orgActor,
    consumer,
    resource_actor: resourceActor
      ? {
          id: resourceActor.id,
          type: resourceActor.type,
          name: resourceActor.name
        }
      : null,
    consumer_profile: consumerProfile
      ? {
          id: consumerProfile.id,
          name: consumerProfile.name,
          status: consumerProfile.status
        }
      : null,
    organization_member: organizationMember
      ? {
          id: organizationMember.id,
          status: organizationMember.status,
          role: organizationMember.role
        }
      : null
  };
};

export let v1DocumentParticipantPresenter = Presenter.create(documentParticipantType)
  .presenter(async ({ documentParticipant }, opts) => ({
    object: 'document.participant',
    id: documentParticipant.id,
    role: documentParticipant.role,
    edit_count: documentParticipant.editCount,
    last_edited_at: documentParticipant.lastEditedAt,
    last_viewed_at: documentParticipant.lastViewedAt,
    actor: await presentDocumentParticipantActor(documentParticipant.resourceActor, opts),
    created_at: documentParticipant.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('document.participant', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      role: v.enumOf(['editor', 'viewer']),
      edit_count: v.number(),
      last_edited_at: v.nullable(v.date()),
      last_viewed_at: v.nullable(v.date()),
      actor: documentParticipantActorSchema,
      created_at: v.date()
    })
  )
  .build();
