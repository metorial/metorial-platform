import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthConnectionEventType } from '../types';

export let v1ProviderOauthConnectionEventPresenter = Presenter.create(
  providerOauthConnectionEventType
)
  .presenter(async ({ providerOauthConnectionEvent }, opts) => ({
    object: 'provider_oauth.connection.event',

    id: providerOauthConnectionEvent.id,
    status: 'active',

    type: providerOauthConnectionEvent.event,
    metadata: providerOauthConnectionEvent.metadata,

    connection_id: providerOauthConnectionEvent.connection.id,

    created_at: providerOauthConnectionEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.connection.event'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this connection event'
      }),

      status: v.enumOf(['active'], {
        name: 'status',
        description: 'The current status of the event'
      }),

      type: v.enumOf(['errors', 'config_auto_updated'], {
        name: 'type',
        description: 'The type of event that occurred'
      }),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata related to the event'
      }),

      connection_id: v.string({
        name: 'connection_id',
        description: 'The ID of the associated OAuth connection'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the event was created'
      })
    })
  )
  .build();
