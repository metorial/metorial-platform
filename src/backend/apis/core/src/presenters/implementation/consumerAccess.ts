import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerAccessType } from '../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';
import { v1MagicMcpGroupPresenter } from './magicMcpGroup';

export let v1ConsumerAccessPresenter = Presenter.create(consumerAccessType)
  .presenter(async ({ consumerAccess }, opts) => ({
    object: 'consumer.access',

    id: consumerAccess.id,

    access: {
      type: consumerAccess.type,
      magic_mcp_group: await v1MagicMcpGroupPresenter
        .present({ magicMcpGroup: consumerAccess.magicMcpGroup! }, opts)
        .run({})
    },

    consumer_group: await v1ConsumerGroupPresenter
      .present({ consumerGroup: consumerAccess.consumerGroup }, opts)
      .run({}),

    created_at: consumerAccess.createdAt,
    updated_at: consumerAccess.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.group', {
        name: 'object',
        description: 'Type of the object, fixed as consumer access'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the consumer access'
      }),

      access: v.object(
        {
          type: v.enumOf(['magic_mcp_group'], {
            name: 'type',
            description: 'The type of access granted'
          }),

          magic_mcp_group: v1MagicMcpGroupPresenter.schema
        },
        {
          name: 'access',
          description: 'Details about the access granted to the consumer'
        }
      ),

      consumer_group: v1ConsumerGroupPresenter.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the consumer access was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the consumer access was last updated'
      })
    })
  )
  .build();
