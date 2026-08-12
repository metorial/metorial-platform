import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { identityActorType } from '../../../types';
import { dashboardConsumerPresenter } from '../../consumer/consumer';

export let v1IdentityActorPresenter = Presenter.create(identityActorType)
  .presenter(async ({ identityActor }) => ({
    object: 'identity.actor' as const,

    id: identityActor.id,
    type: identityActor.type,
    status: identityActor.status,

    agent_id: identityActor.agent?.id ?? null,

    name: identityActor.name,
    description: identityActor.description,
    metadata: identityActor.metadata,

    created_at: identityActor.createdAt,
    updated_at: identityActor.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('identity.actor', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique identity actor identifier.',
        examples: ['iac_6wQpLk2mZa8nYx4b']
      }),
      type: v.enumOf(['person', 'agent'], {
        name: 'type',
        description: 'Type of actor that owns or participates in identities.'
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Current lifecycle status of the identity actor.'
      }),
      name: v.string({
        name: 'name',
        description: 'Human-readable name of the identity actor.',
        examples: ['Build Bot']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional description of the actor.',
          examples: ['CI agent used for release automation']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Additional metadata associated with the actor.',
          examples: [{ team: 'platform', source: 'automation' }]
        })
      ),
      agent_id: v.nullable(
        v.string({
          name: 'agent_id',
          description: 'Linked agent identifier when this actor represents an agent.',
          examples: ['agt_4mNoPq8rSt2uVx6y']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the actor was created.',
        examples: [new Date('2026-02-03T10:15:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the actor was last updated.',
        examples: [new Date('2026-02-10T14:30:00Z')]
      })
    })
  )
  .build();

export let dashboardIdentityActorPresenter = Presenter.create(identityActorType)
  .presenter(async ({ identityActor }, opts) => {
    let inner = await v1IdentityActorPresenter.present({ identityActor }, opts).run();

    return {
      ...inner,
      consumer: identityActor.consumer
        ? await dashboardConsumerPresenter
            .present({ consumer: identityActor.consumer }, opts)
            .run()
        : null
    };
  })
  .schema(
    v.intersection([
      v1IdentityActorPresenter.schema,
      v.object({
        consumer: v.nullable(dashboardConsumerPresenter.schema)
      })
    ])
  )
  .build();
