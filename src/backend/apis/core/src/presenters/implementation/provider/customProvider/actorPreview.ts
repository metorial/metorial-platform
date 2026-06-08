import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { actorPreviewType } from '../../../types';

export let v1ActorPreviewPresenter = Presenter.create(actorPreviewType)
  .presenter(async ({ actor }) => ({
    object: 'custom_provider.actor#preview' as const,

    id: actor.id,
    type: actor.type,
    identifier: actor.identifier,
    name: actor.name,
    organization_actor_id: actor.organizationActorId,

    created_at: actor.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider.actor#preview', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Actor identifier',
        examples: ['act_1aBcDeFgHjKlMnPq']
      }),
      type: v.enumOf(['external', 'system'] as const, {
        name: 'type',
        description: 'Actor type'
      }),
      identifier: v.string({
        name: 'identifier',
        description: 'Actor unique identifier',
        examples: ['mtea-orgact_1aBcDeFgHjKlMnPq']
      }),
      name: v.string({
        name: 'name',
        description: 'Actor display name',
        examples: ['John Doe']
      }),
      organization_actor_id: v.nullable(
        v.string({
          name: 'organization_actor_id',
          description: 'Organization actor ID if linked',
          examples: ['ora_1aBcDeFgHjKlMnPq']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
