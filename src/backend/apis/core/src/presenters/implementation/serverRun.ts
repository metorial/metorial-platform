import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverRunType } from '../types';

export let v1ServerRunPresenter = Presenter.create(serverRunType)
  .presenter(async ({ serverRun }, opts) => ({
    object: 'server.server_run',

    id: serverRun.id,
    status: serverRun.status,
    type: serverRun.type,

    server_version_id: serverRun.serverVersion.id,
    server_deployment_id: serverRun.serverDeployment.id,
    server_session_id: serverRun.serverSession.id,
    session_id: serverRun.serverSession.session.id,

    created_at: serverRun.createdAt,
    updated_at: serverRun.updatedAt,
    started_at: serverRun.startedAt,
    stopped_at: serverRun.stoppedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_run'),

      id: v.string(),
      type: v.enumOf(['hosted', 'external']),
      status: v.enumOf(['active', 'failed', 'completed']),

      server_version_id: v.string(),
      server_deployment_id: v.string(),
      server_session_id: v.string(),
      session_id: v.string(),

      created_at: v.date(),
      updated_at: v.date(),
      started_at: v.nullable(v.date()),
      stopped_at: v.nullable(v.date())
    })
  )
  .build();
