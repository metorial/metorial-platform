import { serverVariantService, serverVersionService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { serverVersionPresenter } from '../../presenters';
import { serverGroup } from './server';

export let serverVersionGroup = serverGroup.use(async ctx => {
  if (!ctx.params.serverVersionId) throw new Error('serverVersionId is required');

  let serverVersion = await serverVersionService.getServerVersionById({
    serverVersionId: ctx.params.serverVersionId,
    server: ctx.server
  });

  return { serverVersion };
});

export let serverVersionController = Controller.create(
  {
    name: 'Server Version',
    description:
      'Servers in Metorial are version controlled. Metorial automatically updates servers to the latest version when available. These endpoints help you keep track of server versions in the Metorial catalog.'
  },
  {
    list: serverGroup
      .get(instancePath('servers/:serverId/versions', 'servers.versions.list'), {
        name: 'List server versions',
        description: 'Retrieve all versions for a given server'
      })
      .use(checkAccess({ possibleScopes: ['instance.server:read'] }))
      .outputList(serverVersionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            variant_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let variant = ctx.query.variant_id
          ? await serverVariantService.getServerVariantById({
              server: ctx.server,
              serverVariantId: ctx.query.variant_id
            })
          : undefined;

        let paginator = await serverVersionService.listServerVersions({
          server: ctx.server,
          variant
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverVersion =>
          serverVersionPresenter.present({ serverVersion })
        );
      }),

    get: serverVersionGroup
      .get(
        instancePath('servers/:serverId/versions/:serverVersionId', 'servers.versions.get'),
        {
          name: 'Get server version',
          description: 'Retrieve details for a specific server version'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server:read'] }))
      .output(serverVersionPresenter)
      .do(async ctx => {
        return serverVersionPresenter.present({ serverVersion: ctx.serverVersion });
      })
  }
);
