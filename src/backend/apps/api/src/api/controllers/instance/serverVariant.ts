import { serverVariantService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { serverVariantPresenter } from '../../presenters';
import { serverGroup } from './server';

export let serverVariantGroup = serverGroup.use(async ctx => {
  let serverVariant = await serverVariantService.getServerVariantById({
    serverVariantId: ctx.params.serverVariantId,
    server: ctx.server
  });

  return { serverVariant };
});

export let serverVariantController = Controller.create(
  {
    name: 'Server Variant',
    description: 'Read and write server variant information'
  },
  {
    list: serverGroup
      .get(instancePath('servers/:serverId/variants', 'servers.variants.list'), {
        name: 'List server variants',
        description: 'List all server variants'
      })
      .use(checkAccess({ possibleScopes: ['instance.server:read'] }))
      .outputList(serverVariantPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await serverVariantService.listServerVariants({
          server: ctx.server
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverVariant =>
          serverVariantPresenter.present({ serverVariant })
        );
      }),

    get: serverVariantGroup
      .get(
        instancePath('servers/:serverId/variants/:serverVariantId', 'servers.variants.get'),
        {
          name: 'Get server variant',
          description: 'Get the information of a specific server variant'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server:read'] }))
      .output(serverVariantPresenter)
      .do(async ctx => {
        return serverVariantPresenter.present({ serverVariant: ctx.serverVariant });
      })
  }
);
