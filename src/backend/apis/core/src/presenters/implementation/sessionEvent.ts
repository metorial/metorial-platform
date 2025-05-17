import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionEventType } from '../types';
import { v1ServerRunPresenter } from './serverRun';

export let v1SessionEventPresenter = Presenter.create(sessionEventType)
  .presenter(async ({ session, sessionEvent }, opts) => ({
    object: 'session.event',

    id: sessionEvent.id,
    type: sessionEvent.type,

    session_id: session.id,

    server_run: sessionEvent.serverRun
      ? await v1ServerRunPresenter
          .present(
            {
              serverRun: {
                ...sessionEvent.serverRun,
                serverSession: {
                  ...sessionEvent.serverRun.serverSession,
                  session
                }
              }
            },
            opts
          )
          .run()
      : null,

    created_at: sessionEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.event'),

      id: v.string(),
      type: v.enumOf([
        'message',
        'error',
        'server_run_created',
        'server_run_started',
        'server_run_stopped',
        'client_connected',
        'client_disconnected'
      ]),

      session_id: v.string(),

      server_run: v.nullable(v1ServerRunPresenter.schema),

      created_at: v.date()
    })
  )
  .build();
