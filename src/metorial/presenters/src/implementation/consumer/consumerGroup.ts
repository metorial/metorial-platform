import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerGroupType } from '../../types';

export let v1ConsumerGroupPresenter = Presenter.create(consumerGroupType)
  .presenter(async ({ consumerGroup }) => ({
    object: 'consumer.group' as const,
    id: consumerGroup.id,
    status: consumerGroup.status,
    name: consumerGroup.name,
    description: consumerGroup.description,
    is_default: consumerGroup.isDefault,
    created_at: consumerGroup.createdAt,
    updated_at: consumerGroup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.group', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you delete the group. Archived groups stay listable.'
      }),
      name: v.string({ description: 'Display name.' }),
      description: v.nullable(v.string({ description: 'Free-text description.' })),
      is_default: v.boolean({
        description: 'Whether this is a default group on the portal.'
      }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();

export let dashboardConsumerGroupPresenter = Presenter.create(consumerGroupType)
  .presenter(async ({ consumerGroup }, opts) => {
    let inner = await v1ConsumerGroupPresenter.present({ consumerGroup }, opts).run({});

    return {
      ...inner,

      is_managed: consumerGroup.isManaged,
      is_default_everyone_group: consumerGroup.isDefaultEveryoneGroup
    };
  })
  .schema(
    v.intersection([
      v1ConsumerGroupPresenter.schema,
      v.object({
        is_managed: v.boolean({
          description: 'Whether Metorial manages this group automatically.'
        }),
        is_default_everyone_group: v.boolean({
          description: 'Whether this is the everyone group every consumer belongs to.'
        })
      })
    ])
  )
  .build();
