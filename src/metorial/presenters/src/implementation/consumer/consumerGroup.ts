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
      object: v.literal('consumer.group'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      is_default: v.boolean(),
      created_at: v.date(),
      updated_at: v.date()
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
        is_managed: v.boolean(),
        is_default_everyone_group: v.boolean()
      })
    ])
  )
  .build();
