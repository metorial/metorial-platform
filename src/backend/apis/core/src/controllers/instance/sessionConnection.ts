import { sessionConnectionService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { sessionConnectionPresenter } from '../../presenters';
import { sessionGroup } from './session';

export let sessionConnectionGroup = sessionGroup.use(async ctx => {
  if (!ctx.params.sessionConnectionId) throw new Error('sessionConnectionId is required');

  let sessionConnection = await sessionConnectionService.getSessionConnectionById({
    sessionConnectionId: ctx.params.sessionConnectionId,
    session: ctx.session
  });

  return { sessionConnection };
});

export let sessionConnectionController = Controller.create(
  {
    name: 'Session Connection',
    description: 'Read and write session connection information'
  },
  {
    list: sessionGroup
      .get(instancePath('sessions/:sessionId/connections', 'sessions.connections.list'), {
        name: 'List session connections',
        description: 'List all session connections'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .outputList(sessionConnectionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await sessionConnectionService.listSessionConnections({
          session: ctx.session
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionConnection =>
          sessionConnectionPresenter.present({ sessionConnection, session: ctx.session })
        );
      }),

    get: sessionConnectionGroup
      .get(
        instancePath(
          'sessions/:sessionId/connections/:sessionConnectionId',
          'sessions.connections.get'
        ),
        {
          name: 'Get session connection',
          description: 'Get the information of a specific session connection'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .output(sessionConnectionPresenter)
      .do(async ctx => {
        return sessionConnectionPresenter.present({
          sessionConnection: ctx.sessionConnection,
          session: ctx.session
        });
      })
  }
);
