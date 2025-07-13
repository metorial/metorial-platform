import { sessionMessageService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { sessionMessagePresenter } from '../../presenters';
import { sessionGroup } from './session';

export let sessionMessageGroup = sessionGroup.use(async ctx => {
  if (!ctx.params.sessionMessageId) throw new Error('sessionMessageId is required');

  let sessionMessage = await sessionMessageService.getSessionMessageById({
    sessionMessageId: ctx.params.sessionMessageId,
    session: ctx.session
  });

  return { sessionMessage };
});

export let sessionMessageController = Controller.create(
  {
    name: 'SessionMessage',
    description: 'Read and write session message information'
  },
  {
    list: sessionGroup
      .get(instancePath('sessions/:sessionId/messages', 'sessions.messages.list'), {
        name: 'List session messages',
        description: 'List all messages for a specific session'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .outputList(sessionMessagePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_run_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_session_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await sessionMessageService.listSessionMessages({
          session: ctx.session,
          serverRunIds: normalizeArrayParam(ctx.query.server_run_id),
          serverSessionIds: normalizeArrayParam(ctx.query.server_session_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionMessage =>
          sessionMessagePresenter.present({ sessionMessage, session: ctx.session })
        );
      }),

    get: sessionMessageGroup
      .get(
        instancePath(
          'sessions/:sessionId/messages/:sessionMessageId',
          'sessions.messages.get'
        ),
        {
          name: 'Get session message',
          description: 'Get details of a specific session message'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .output(sessionMessagePresenter)
      .do(async ctx => {
        return sessionMessagePresenter.present({
          sessionMessage: ctx.sessionMessage,
          session: ctx.session
        });
      })
  }
);
