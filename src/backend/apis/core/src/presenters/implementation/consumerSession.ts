import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerSessionType } from '../types';

export let v1ConsumerSessionPresenter = Presenter.create(consumerSessionType)
  .presenter(async ({ consumerSession }, opts) => ({
    object: 'consumer.session',

    id: consumerSession.id,

    created_at: consumerSession.createdAt,
    expires_at: consumerSession.expiresAt,
    last_used_at: consumerSession.lastUsedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.session', {
        name: 'object',
        description: 'Type of the object, fixed as consumer.session'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the consumer session'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the session was created'
      }),

      expires_at: v.date({
        name: 'expires_at',
        description: 'The ISO 8601 timestamp when the session will expire'
      }),

      last_used_at: v.date({
        name: 'last_used_at',
        description:
          'The ISO 8601 timestamp when the session was last used, or null if never used'
      })
    })
  )
  .build();
