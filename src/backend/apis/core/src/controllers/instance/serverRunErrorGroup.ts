import { serverRunErrorGroupService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverRunErrorGroupPresenter } from '../../presenters';

export let serverRunErrorGroupGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverRunErrorGroupId) throw new Error('serverRunErrorGroupId is required');

  let serverRunErrorGroup = await serverRunErrorGroupService.getServerRunErrorGroupById({
    serverRunErrorGroupId: ctx.params.serverRunErrorGroupId,
    instance: ctx.instance
  });

  return { serverRunErrorGroup };
});

export let serverRunErrorGroupController = Controller.create(
  {
    name: 'Server Run Error Group',
    description: 'Read and write server run error group information'
  },
  {
    list: instanceGroup
      .get(instancePath('server-run-error-groups', 'serverRunErrorGroups.list'), {
        name: 'List server deployments',
        description: 'List all server deployments'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.server_error:read'] }))
      .outputList(serverRunErrorGroupPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverRunErrorGroupService.listServerRunErrorGroups({
          instance: ctx.instance,
          serverIds: normalizeArrayParam(ctx.query.server_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverRunErrorGroup =>
          serverRunErrorGroupPresenter.present({ serverRunErrorGroup })
        );
      }),

    get: serverRunErrorGroupGroup
      .get(
        instancePath(
          'server-run-error-groups/:serverRunErrorGroupId',
          'serverRunErrorGroups.get'
        ),
        {
          name: 'Get server run error group',
          description: 'Get the information of a specific server run error group'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.server_error:read'] }))
      .output(serverRunErrorGroupPresenter)
      .do(async ctx => {
        return serverRunErrorGroupPresenter.present({
          serverRunErrorGroup: ctx.serverRunErrorGroup
        });
      })
  }
);
