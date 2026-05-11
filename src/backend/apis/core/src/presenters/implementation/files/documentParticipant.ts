import { v } from '@lowerdeck/validation';
import type { EnrichedCargoDocumentActor } from '@metorial/module-file';
import type { PresenterContext } from '@metorial/presenter';
import { Presenter } from '@metorial/presenter';
import { documentParticipantType } from '../../types';
import { v1ConsumerPresenter } from '../consumer/consumer';
import { v1OrganizationActorPresenter } from '../organization/organizationActor';

export let documentParticipantActorSchema = v.object({
  type: v.enumOf(['organization_actor', 'consumer', 'unknown']),
  name: v.string(),
  image_url: v.nullable(v.string()),
  organization_actor: v.nullable(v1OrganizationActorPresenter.schema),
  consumer: v.nullable(v1ConsumerPresenter.schema)
});

export let presentDocumentParticipantActor = async (
  actor: EnrichedCargoDocumentActor,
  opts: PresenterContext
) => {
  let orgActor = actor.organizationActor
    ? await v1OrganizationActorPresenter
        .present({ organizationActor: actor.organizationActor }, opts)
        .run()
    : null;
  let consumer = actor.consumer
    ? await v1ConsumerPresenter.present({ consumer: actor.consumer }, opts).run()
    : null;

  return {
    type: actor.organizationActor
      ? ('organization_actor' as const)
      : actor.consumer
        ? ('consumer' as const)
        : ('unknown' as const),

    name: actor.name,
    image_url: orgActor?.image_url ?? consumer?.image_url ?? null,
    organization_actor: orgActor,
    consumer: consumer
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
    actor: await presentDocumentParticipantActor(documentParticipant.actor, opts),
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
