import { serverSessionService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { serverSessionPresenter } from '../../presenters';
import { sessionGroup } from './session';

export let serverSessionGroup = sessionGroup.use(async ctx => {
  if (!ctx.params.serverSessionId) throw new Error('serverSessionId is required');

  let serverSession = await serverSessionService.getServerSessionById({
    serverSessionId: ctx.params.serverSessionId,
    session: ctx.session
  });

  return { serverSession };
});

export let serverSessionController = Controller.create(
  {
    name: 'Server Session',
    description: 'Read and write server session information'
  },
  {
    list: sessionGroup
      .get(
        instancePath('sessions/:sessionId/server-sessions', 'sessions.serverSessions.list'),
        {
          name: 'List server sessions',
          description: 'List all server sessions'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .outputList(serverSessionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await serverSessionService.listServerSessions({
          session: ctx.session
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverSession =>
          serverSessionPresenter.present({ serverSession, session: ctx.session })
        );
      }),

    get: serverSessionGroup
      .get(
        instancePath(
          'sessions/:sessionId/server-sessions/:serverSessionId',
          'sessions.serverSessions.get'
        ),
        {
          name: 'Get server session',
          description: 'Get the information of a specific server session'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .output(serverSessionPresenter)
      .do(async ctx => {
        return serverSessionPresenter.present({
          serverSession: ctx.serverSession,
          session: ctx.session
        });
      })
  }
);
