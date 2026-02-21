import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionParticipantService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { sessionParticipantPresenter } from '../../presenters';

export let subspaceSessionParticipantGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionParticipantId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionParticipantId is required',
        description: 'The sessionParticipantId path parameter is required.'
      })
    );
  }

  let sessionParticipant = await subspaceSessionParticipantService.get({
    instance: ctx.instance,
    sessionParticipantId: ctx.params.sessionParticipantId
  });

  return { sessionParticipant };
});

export let subspaceSessionParticipantController = Controller.create(
  {
    name: 'Session Participants',
    description:
      'Session participants represent the clients and other entities that are connected to a session. This read-only resource tracks who is participating in a session.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-participants', 'sessions.participants.list'), {
        name: 'List session participants',
        description: 'Returns a paginated list of participants in a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(sessionParticipantPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.string(), { description: 'Filter by participant type' })

            //             types: ("unknown" | "provider" | "system" | "tool_call" | "mcp_client" | "metorial_protocol_client")[] | undefined;
            // ids: string[] | undefined;
            // sessionIds: string[] | undefined;
            // sessionConnectionIds: string[] | undefined;
            // sessionMessageIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionParticipantService.list({
          instance: ctx.instance,
          sessionIds: [ctx.session.id]
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionParticipant =>
          sessionParticipantPresenter.present({ sessionParticipant })
        );
      }),

    get: subspaceSessionParticipantGroup
      .get(
        instancePath(
          'session-participants/:sessionParticipantId',
          'sessions.participants.get'
        ),
        {
          name: 'Get session participant',
          description: 'Retrieves a specific participant in a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(sessionParticipantPresenter)
      .do(async ctx => {
        return sessionParticipantPresenter.present({
          sessionParticipant: ctx.sessionParticipant
        });
      })
  }
);
