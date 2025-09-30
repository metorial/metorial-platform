import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverOauthSessionType } from '../types';
import { v1ProviderOauthConnectionPresenter } from './providerOauthConnection';

export let v1ServerOauthSessionPresenter = Presenter.create(serverOauthSessionType)
  .presenter(async ({ serverOauthSession }, opts) => ({
    object: 'provider_oauth.session',

    id: serverOauthSession.id,
    status: serverOauthSession.status,

    url: `${getConfig().urls.portalsUrl}/oauth/sessions/${serverOauthSession.clientSecret}`,

    metadata: serverOauthSession.metadata ?? {},
    redirect_uri: serverOauthSession.redirectUri,

    connection: await v1ProviderOauthConnectionPresenter
      .present({ providerOauthConnection: serverOauthSession.connection }, opts)
      .run(),

    instance_id: serverOauthSession.connection.instance.id,

    completed_at: serverOauthSession.completedAt,
    created_at: serverOauthSession.createdAt,
    updated_at: serverOauthSession.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.session'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth session'
      }),

      status: v.enumOf(['pending', 'opened', 'completed', 'failed'], {
        name: 'status',
        description: 'The current state of the session'
      }),

      url: v.string({
        name: 'url',
        description: 'The URL where the user can complete the OAuth flow'
      }),

      connection: v1ProviderOauthConnectionPresenter.schema,

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'A key-value map of additional metadata for the session'
      }),

      redirect_uri: v.nullable(
        v.string({
          name: 'redirect_uri',
          description: 'The URI to redirect to after the OAuth flow is complete'
        })
      ),

      instance_id: v.string({
        name: 'instance_id',
        description: 'The instance that this session belongs to'
      }),

      completed_at: v.nullable(
        v.date({
          name: 'completed_at',
          description: 'Timestamp when the session was completed'
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the session was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the session was last updated'
      })
    })
  )
  .build();
