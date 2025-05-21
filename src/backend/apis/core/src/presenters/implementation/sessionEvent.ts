import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionEventType } from '../types';
import { v1ServerRunPresenter } from './serverRun';
import { v1ServerRunErrorPresenter } from './serverRunError';

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

    server_run_error: sessionEvent.serverRunError
      ? await v1ServerRunErrorPresenter
          .present(
            {
              serverRunError: {
                ...sessionEvent.serverRunError,
                serverRun: {
                  ...sessionEvent.serverRunError.serverRun,
                  serverSession: {
                    ...sessionEvent.serverRunError.serverRun.serverSession,
                    session
                  }
                }
              }
            },
            opts
          )
          .run()
      : null,

    log_lines: sessionEvent.logLines.map(l => {
      let firstChar = l[0];
      let rest = l.slice(1);
      let type = firstChar == 'O' ? 'stdout' : 'stderr';

      return {
        type,
        line: rest
      };
    }),

    created_at: sessionEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.event'),

      id: v.string(),
      type: v.enumOf(['server_logs', 'server_run_error']),

      session_id: v.string(),

      server_run: v.nullable(v1ServerRunPresenter.schema),
      server_run_error: v.nullable(v1ServerRunErrorPresenter.schema),

      log_lines: v.array(
        v.object({
          type: v.enumOf(['stdout', 'stderr']),
          line: v.string()
        })
      ),

      created_at: v.date()
    })
  )
  .build();
