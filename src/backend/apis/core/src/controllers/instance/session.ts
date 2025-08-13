import { SessionStatus } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { serverDeploymentService } from '@metorial/module-server-deployment';
import { sessionService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { sessionPresenter } from '../../presenters';
import { createServerDeployment, createServerDeploymentSchema } from './serverDeployment';

export let sessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionId) throw new Error('sessionId is required');

  let session = await sessionService.getSessionById({
    sessionId: ctx.params.sessionId,
    instance: ctx.instance
  });

  return { session };
});

export let sessionController = Controller.create(
  {
    name: 'Session',
    description:
      'Before you can connect to an MCP server, you need to create a session. Each session can be linked to one or more server deployments, allowing you to connect to multiple servers simultaneously. Once you have created a session, you can use the provided MCP URL to connect to the server deployments via MCP.'
  },
  {
    list: instanceGroup
      .get(instancePath('sessions', 'sessions.list'), {
        name: 'List sessions',
        description: 'List all sessions'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .outputList(sessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(SessionStatus) as any),
                v.array(v.enumOf(Object.keys(SessionStatus) as any))
              ])
            ),
            server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_variant_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_implementation_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await sessionService.listSessions({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          serverIds: normalizeArrayParam(ctx.query.server_id),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_id),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_id),
          serverDeploymentIds: normalizeArrayParam(ctx.query.server_deployment_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, session => sessionPresenter.present({ session }));
      }),

    get: sessionGroup
      .get(instancePath('sessions/:sessionId', 'sessions.get'), {
        name: 'Get session',
        description: 'Get the information of a specific session'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .output(sessionPresenter)
      .do(async ctx => {
        return sessionPresenter.present({ session: ctx.session });
      }),

    create: instanceGroup
      .post(instancePath('sessions', 'sessions.create'), {
        name: 'Create session',
        description: 'Create a new session'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:write'] }))
      .body(
        'default',
        v.union([
          v.object({
            server_deployments: v.array(
              v.union([
                createServerDeploymentSchema,
                v.string(),
                v.object({
                  server_deployment_id: v.string()
                })
              ])
            )
          }),
          v.object({
            server_deployment_ids: v.union([v.array(v.string()), v.string()])
          })
        ])
      )
      .output(sessionPresenter)
      .do(async ctx => {
        let serverDeploymentInputs =
          'server_deployments' in ctx.body
            ? ctx.body.server_deployments
            : Array.isArray(ctx.body.server_deployment_ids)
              ? ctx.body.server_deployment_ids
              : [ctx.body.server_deployment_ids];

        let deploymentIds = serverDeploymentInputs
          .map(d => {
            if (typeof d === 'string') return d;
            return 'server_deployment_id' in d ? d.server_deployment_id : undefined!;
          })
          .filter(Boolean);

        let existingServerDeployments = deploymentIds.length
          ? await serverDeploymentService.getManyServerDeployments({
              instance: ctx.instance,
              serverDeploymentIds: deploymentIds
            })
          : [];

        if (existingServerDeployments.some(d => d.status !== 'active')) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot create session with inactive server deployments'
            })
          );
        }

        let deploymentsToCreate = serverDeploymentInputs
          .map(d => {
            if (typeof d !== 'object' || 'server_deployment_id' in d) return undefined!;
            return d;
          })
          .filter(Boolean);

        let newServerDeployments = await Promise.all(
          deploymentsToCreate.map(async d =>
            createServerDeployment(
              d,
              {
                instance: ctx.instance,
                organization: ctx.organization,
                actor: ctx.actor
              },
              { type: 'ephemeral' }
            )
          )
        );

        let serverDeployments = [...existingServerDeployments, ...newServerDeployments];

        let session = await sessionService.createSession({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          input: {
            connectionType: 'unified',
            serverDeployments
          },
          ephemeralPermittedDeployments: new Set(newServerDeployments.map(d => d.id))
        });

        return sessionPresenter.present({ session });
      }),

    delete: sessionGroup
      .delete(instancePath('sessions/:sessionId', 'sessions.delete'), {
        name: 'Delete session',
        description: 'Delete a session'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:write'] }))
      .output(sessionPresenter)
      .do(async ctx => {
        let session = await sessionService.deleteSession({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          session: ctx.session
        });

        return sessionPresenter.present({ session });
      })
  }
);
