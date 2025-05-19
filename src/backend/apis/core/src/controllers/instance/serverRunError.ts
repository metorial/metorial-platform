import { serverRunErrorService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverRunErrorPresenter } from '../../presenters';

export let serverRunErrorGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverRunErrorId) throw new Error('serverRunErrorId is required');

  let serverRunError = await serverRunErrorService.getServerRunErrorById({
    serverRunErrorId: ctx.params.serverRunErrorId,
    instance: ctx.instance
  });

  return { serverRunError };
});

export let serverRunErrorController = Controller.create(
  {
    name: 'Server Run Error',
    description: 'Read and write server run error information'
  },
  {
    list: instanceGroup
      .get(instancePath('server-run-errors', 'serverRunErrors.list'), {
        name: 'List server deployments',
        description: 'List all server deployments'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.server_error:read'] }))
      .outputList(serverRunErrorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_session_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_implementation_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_deployment_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_run_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_run_error_group_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverRunErrorService.listServerRunErrors({
          instance: ctx.instance,
          serverSessionIds: normalizeArrayParam(ctx.query.server_session_ids),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_ids),
          serverDeploymentIds: normalizeArrayParam(ctx.query.server_deployment_ids),
          serverRunIds: normalizeArrayParam(ctx.query.server_run_ids),
          serverRunErrorGroupIds: normalizeArrayParam(ctx.query.server_run_error_group_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverRunError =>
          serverRunErrorPresenter.present({ serverRunError })
        );
      }),

    get: serverRunErrorGroup
      .get(instancePath('server-run-errors/:serverRunErrorId', 'serverRunErrors.get'), {
        name: 'Get server run error',
        description: 'Get the information of a specific server run error'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.server_error:read'] }))
      .output(serverRunErrorPresenter)
      .do(async ctx => {
        return serverRunErrorPresenter.present({ serverRunError: ctx.serverRunError });
      })
  }
);
