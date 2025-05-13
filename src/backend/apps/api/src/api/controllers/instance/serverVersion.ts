import { serverVariantService, serverVersionService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { instancePath } from '../../middleware/instanceGroup';
import { serverVersionPresenter } from '../../presenters';
import { serverGroup } from './server';

export let serverVersionGroup = serverGroup.use(async ctx => {
  let serverVersion = await serverVersionService.getServerVersionById({
    serverVersionId: ctx.params.serverVersionId,
    server: ctx.server
  });

  return { serverVersion };
});

export let serverVersionController = Controller.create(
  {
    name: 'Server Version',
    description: 'Read and write server version information'
  },
  {
    list: serverGroup
      .get(instancePath('servers/:serverId/versions', 'servers.versions.list'), {
        name: 'List server versions',
        description: 'List all server versions'
      })
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
          description: 'Get the information of a specific server version'
        }
      )
      .output(serverVersionPresenter)
      .do(async ctx => {
        return serverVersionPresenter.present({ serverVersion: ctx.serverVersion });
      })
  }
);
