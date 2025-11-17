import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerGroupType } from '../types';

export let v1ConsumerGroupPresenter = Presenter.create(consumerGroupType)
  .presenter(async ({ consumerGroup }, opts) => ({
    object: 'consumer.group',

    id: consumerGroup.id,

    status: {
      active: 'active',
      inactive: 'inactive'
    }[consumerGroup.status],

    name: consumerGroup.name,
    description: consumerGroup.description,

    is_default: consumerGroup.isDefault,
    sso_group_ids: consumerGroup.ssoGroupIds,

    created_at: consumerGroup.createdAt,
    updated_at: consumerGroup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.group', {
        name: 'object',
        description: 'Type of the object, fixed as consumer group'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the consumer group'
      }),

      status: v.enumOf(['active', 'inactive'], {
        name: 'status',
        description: 'The status of the consumer group'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the consumer group'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'The description of the consumer group'
        })
      ),

      is_default: v.boolean({
        name: 'is_default',
        description: 'Indicates if this is the default consumer group'
      }),

      sso_group_ids: v.array(v.string(), {
        name: 'sso_group_ids',
        description: 'List of SSO group IDs associated with this consumer group'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the consumer group was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the consumer group was last updated'
      })
    })
  )
  .build();
