import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverDeploymentType } from '../types';
import { v1CallbackPresenter } from './callback';
import { v1ProviderOauthConnectionPresenter } from './providerOauthConnection';
import { v1ServerDeploymentConfigPresenter } from './serverDeploymentConfig';
import { v1ServerImplementationPresenter } from './serverImplementation';
import { v1ServerPreview } from './serverPreview';

export let v1ServerDeploymentPresenter = Presenter.create(serverDeploymentType)
  .presenter(async ({ serverDeployment }, opts) => ({
    object: 'server.server_deployment',

    id: serverDeployment.id,
    status: serverDeployment.status,

    name: serverDeployment.name,
    description: serverDeployment.description,

    result: serverDeployment.failureCode
      ? {
          status: 'failed',
          code: serverDeployment.failureCode,
          message: serverDeployment.failureMessage
        }
      : // : serverDeployment.isOauthConnectionPending
        //   ? { status: 'pending', step: 'oauth_discovery' }
        { status: 'active' },

    metadata: serverDeployment.metadata ?? {},

    oauth_connection: serverDeployment.oauthConnection
      ? await v1ProviderOauthConnectionPresenter
          .present({ providerOauthConnection: serverDeployment.oauthConnection }, opts)
          .run()
      : null,

    callback: serverDeployment.callback
      ? await v1CallbackPresenter.present({ callback: serverDeployment.callback }, opts).run()
      : null,

    server: v1ServerPreview(serverDeployment.server),

    config: await v1ServerDeploymentConfigPresenter
      .present({ config: serverDeployment.config }, opts)
      .run(),

    server_implementation: await v1ServerImplementationPresenter
      .present({ serverImplementation: serverDeployment.serverImplementation }, opts)
      .run(),

    created_at: serverDeployment.createdAt,
    updated_at: serverDeployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_deployment'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server deployment'
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The current status of the server deployment'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the server deployment'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'An optional description of the server deployment'
        })
      ),

      oauth_connection: v.nullable(v1ProviderOauthConnectionPresenter.schema),

      callback: v.nullable(v1CallbackPresenter.schema),

      result: v.union(
        [
          v.object({
            status: v.literal('active', {
              name: 'status',
              description: 'The server deployment is active and functioning correctly'
            })
          }),
          v.object({
            status: v.literal('pending', {
              name: 'status',
              description: 'The server deployment is being processed by Metorial'
            }),
            step: v.enumOf(['oauth_discovery'], {
              name: 'step',
              description: 'The current step required to complete the deployment setup'
            })
          }),
          v.object({
            status: v.literal('failed', {
              name: 'status',
              description: 'The server deployment has failed'
            }),
            code: v.string({
              name: 'code',
              description: 'A code representing the type of failure'
            }),
            message: v.string({
              name: 'message',
              description: 'A detailed message describing the failure'
            })
          })
        ],
        {
          name: 'result',
          description:
            'The result status of the server deployment, indicating success, pending actions, or failure details'
        }
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional arbitrary metadata related to the server deployment'
      }),

      secret_id: v.string({
        name: 'secret_id',
        description: 'Identifier for associated secrets related to this deployment'
      }),

      server: v1ServerPreview.schema,

      config: v1ServerDeploymentConfigPresenter.schema,

      server_implementation: v1ServerImplementationPresenter.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server deployment was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server deployment was last updated'
      })
    })
  )
  .build();
