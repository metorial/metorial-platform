import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverRunType } from '../types';
import { v1ServerDeploymentPreview } from './serverDeploymentPreview';
import { v1ServerPreview } from './serverPreview';
import { v1ServerSessionPreview } from './serverSessionPreview';

export let v1ServerRunPresenter = Presenter.create(serverRunType)
  .presenter(async ({ serverRun }, opts) => ({
    object: 'server.server_run',

    id: serverRun.id,
    status: serverRun.status,
    type: serverRun.type,

    server_version_id: serverRun.serverVersion.id,

    server: v1ServerPreview(serverRun.serverDeployment.server),

    server_deployment: v1ServerDeploymentPreview(
      serverRun.serverDeployment,
      serverRun.serverDeployment.server
    ),

    server_session: v1ServerSessionPreview(
      serverRun.serverSession,
      serverRun.serverSession.session
    ),

    created_at: serverRun.createdAt,
    updated_at: serverRun.updatedAt,
    started_at: serverRun.startedAt,
    stopped_at: serverRun.stoppedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_run'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server run'
      }),

      type: v.enumOf(['hosted', 'external'], {
        name: 'type',
        description: 'The type of the server run'
      }),

      status: v.enumOf(['active', 'failed', 'completed'], {
        name: 'status',
        description: 'The current status of the server run'
      }),

      server_version_id: v.string({
        name: 'server_version_id',
        description: 'The unique identifier of the server version associated with this run'
      }),

      server: v1ServerPreview.schema,

      server_deployment: v1ServerDeploymentPreview.schema,

      server_session: v1ServerSessionPreview.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server run was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server run was last updated'
      }),

      started_at: v.nullable(
        v.date({
          name: 'started_at',
          description: 'Timestamp when the server run was started'
        })
      ),

      stopped_at: v.nullable(
        v.date({
          name: 'stopped_at',
          description: 'Timestamp when the server run was stopped'
        })
      )
    })
  )
  .build();
