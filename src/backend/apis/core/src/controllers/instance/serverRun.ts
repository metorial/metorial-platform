import { ServerRunStatus } from '@metorial/db';
import { serverRunService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverRunPresenter } from '../../presenters';

export let serverRunGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverRunId) throw new Error('serverRunId is required');

  let serverRun = await serverRunService.getServerRunById({
    serverRunId: ctx.params.serverRunId,
    instance: ctx.instance
  });

  return { serverRun };
});

export let serverRunController = Controller.create(
  {
    name: 'Server Run',
    description: 'Read and write server run information'
  },
  {
    list: instanceGroup
      .get(instancePath('server-runs', 'serverRuns.list'), {
        name: 'List server deployments',
        description: 'List all server deployments'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.server_run:read'] }))
      .outputList(serverRunPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(ServerRunStatus) as any),
                v.array(v.enumOf(Object.keys(ServerRunStatus) as any))
              ])
            ),

            server_session_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_implementation_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_deployment_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverRunService.listServerRuns({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as any,
          serverSessionIds: normalizeArrayParam(ctx.query.server_session_ids),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_ids),
          serverDeploymentIds: normalizeArrayParam(ctx.query.server_deployment_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverRun => serverRunPresenter.present({ serverRun }));
      }),

    get: serverRunGroup
      .get(instancePath('server-runs/:serverRunId', 'serverRuns.get'), {
        name: 'Get server run',
        description: 'Get the information of a specific server run'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.server_run:read'] }))
      .output(serverRunPresenter)
      .do(async ctx => {
        return serverRunPresenter.present({ serverRun: ctx.serverRun });
      })
  }
);
