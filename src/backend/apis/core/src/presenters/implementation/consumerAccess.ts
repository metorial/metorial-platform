import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerAccessType } from '../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';
import { v1ServerDeploymentTemplatePresenter } from './serverDeploymentTemplate';
import { v1ServerDeploymentTemplatePreview } from './serverDeploymentTemplatePreview';

export let v1ConsumerAccessPresenter = Presenter.create(consumerAccessType)
  .presenter(async ({ consumerAccess }, opts) => ({
    object: 'consumer.access',

    id: consumerAccess.id,

    access: {
      type: 'server_deployment_template',
      server_deployment_template: v1ServerDeploymentTemplatePreview(
        consumerAccess.serverDeploymentTemplate!
      )
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
          type: v.enumOf(['server_deployment_template'], {
            name: 'type',
            description: 'The type of access granted'
          }),

          server_deployment_template: v1ServerDeploymentTemplatePresenter.schema
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
