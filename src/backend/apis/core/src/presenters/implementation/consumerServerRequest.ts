import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerServerRequestType } from '../types';
import { v1ConsumerProfilePreview } from './consumerProfilePreview';
import { v1ServerPreview } from './serverPreview';

export let v1ConsumerServerRequestPresenter = Presenter.create(consumerServerRequestType)
  .presenter(async ({ consumerServerRequest }, opts) => ({
    object: 'consumer.server_request',

    id: consumerServerRequest.id,

    server: await v1ServerPreview(consumerServerRequest.server),
    consumer: await v1ConsumerProfilePreview(consumerServerRequest.consumerProfile),

    reason: consumerServerRequest.requestReason,
    rejection_reason: consumerServerRequest.rejectReason,

    status: {
      approved: 'approved',
      rejected: 'rejected',
      pending: 'pending'
    }[consumerServerRequest.status],

    created_at: consumerServerRequest.createdAt,
    updated_at: consumerServerRequest.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.server_request', {
        name: 'object',
        description: 'Type of the object, fixed as consumer.server_request'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the consumer server request'
      }),

      server: v1ServerPreview.schema,

      consumer: v1ConsumerProfilePreview.schema,

      reason: v.string({
        name: 'reason',
        description: 'The reason provided by the consumer for making this server request'
      }),

      rejection_reason: v.nullable(
        v.string({
          name: 'rejection_reason',
          description:
            'The reason provided by the administrator for rejecting this server request, or null if not rejected'
        })
      ),

      status: v.enumOf(['approved', 'rejected', 'pending'], {
        name: 'status',
        description: 'The current status of the consumer server request'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the consumer server request was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the consumer server request was last updated'
      })
    })
  )
  .build();
