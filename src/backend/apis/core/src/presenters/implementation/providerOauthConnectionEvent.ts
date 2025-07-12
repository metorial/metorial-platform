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

      id: v.string(),
      status: v.enumOf(['active']),

      type: v.enumOf(['errors', 'config_auto_updated']),
      metadata: v.record(v.any()),

      connection_id: v.string(),

      created_at: v.date()
    })
  )
  .build();
