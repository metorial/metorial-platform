import { v } from '@lowerdeck/validation';
import type { ResourceActorPresentationRecord } from '@metorial/module-resource-tenant';
import type { PresenterContext } from '@metorial/presenter';
import { Presenter } from '@metorial/presenter';
import { documentParticipantType } from '../../types';
import { v1ConsumerProfilePresenter } from '../consumer';
import { v1ConsumerPresenter } from '../consumer/consumer';
import { v1OrganizationActorPresenter } from '../organization/organizationActor';

export let documentParticipantActorSchema = v.object({
  type: v.enumOf(['organization_actor', 'consumer', 'resource_actor']),
  name: v.string(),
  image_url: v.nullable(v.string()),
  email: v.nullable(v.string()),
  organization_actor: v.nullable(v1OrganizationActorPresenter.schema),
  consumer: v.nullable(v1ConsumerPresenter.schema),
  consumer_profile: v.nullable(v1ConsumerProfilePresenter.schema)
});

export let presentDocumentParticipantActor = async (
  actor: Pick<
    ResourceActorPresentationRecord,
    'name' | 'organizationActor' | 'consumer' | 'consumerProfile'
  >,
  opts: PresenterContext
) => {
  let instanceConsumer =
    actor.consumer && actor.consumerProfile
      ? actor.consumer.instanceConsumers.find(
          i => i.instanceOid === actor.consumerProfile!.instanceOid
        )
      : null;
  let consumerProfile =
    actor.consumerProfile && instanceConsumer
      ? await v1ConsumerProfilePresenter
          .present(
            {
              consumerProfile: actor.consumerProfile as any,
              instanceConsumer,
              assignedConsumerGroups: undefined
            },
            opts
          )
          .run()
      : null;
  let consumer =
    instanceConsumer && actor.consumerProfile && actor.consumer
      ? await v1ConsumerPresenter.present({ consumer: instanceConsumer }, opts).run()
      : null;

  let organizationActor = actor.organizationActor
    ? await v1OrganizationActorPresenter
        .present({ organizationActor: actor.organizationActor }, opts)
        .run()
    : null;

  return {
    type: organizationActor
      ? ('organization_actor' as const)
      : instanceConsumer
        ? ('consumer' as const)
        : ('resource_actor' as const),

    name: organizationActor?.name ?? instanceConsumer?.name ?? actor.name,
    image_url: organizationActor?.image_url ?? consumer?.image_url ?? null,
    email: organizationActor?.email ?? consumer?.email ?? null,

    organization_actor: organizationActor,

    consumer,
    consumer_profile: consumerProfile
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
