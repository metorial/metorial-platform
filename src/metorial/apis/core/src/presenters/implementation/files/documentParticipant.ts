import { v } from '@lowerdeck/validation';
import { db, type ResourceActor } from '@metorial/db';
import type { AssistantConversationWithAssistant } from '@metorial/module-assistant';
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
});

export let presentDocumentParticipantActor = async (
  actor:
    | ResourceActor
    | AssistantConversationWithAssistant['createdByActor'],
  opts: PresenterContext
) => {
  let enrichedActor = 'organizationActor' in actor ? actor : null;
  let resourceActor = enrichedActor ? null : (actor as ResourceActor);
  let organizationActor = enrichedActor
    ? enrichedActor.organizationActor
    : resourceActor?.organizationActorOid
    ? await db.organizationActor.findUnique({
        where: {
            oid: resourceActor.organizationActorOid
        },
        include: {
          organization: true,
          teams: {
            include: {
              team: true
            }
          }
        }
      })
    : null;
  let instanceConsumer =
    enrichedActor
      ? enrichedActor.consumer
      : !organizationActor && resourceActor?.consumerOid
      ? await db.instanceConsumer.findFirst({
          where: {
              consumerOid: resourceActor.consumerOid
          },
          include: {
            consumer: {
              include: {
                organizationMember: true,
                profiles: {
                  include: {
                    surface: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        })
        : null;

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
