import { serverVariantService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { serverVariantPresenter } from '../../presenters';
import { serverGroup } from './server';

export let serverVariantGroup = serverGroup.use(async ctx => {
  if (!ctx.params.serverVariantId) throw new Error('serverVariantId is required');

  let serverVariant = await serverVariantService.getServerVariantById({
    serverVariantId: ctx.params.serverVariantId,
    instance: ctx.instance,
    server: ctx.server
  });

  return { serverVariant };
});

export let serverVariantController = Controller.create(
  {
    name: 'Server Variant',
    description:
      'Server variants define different instances of a server, each with its own configuration and capabilities. By default, Metorial picks the best variant automatically, but you can specify a variant if needed.'
  },
  {
    list: serverGroup
      .get(instancePath('servers/:serverId/variants', 'servers.variants.list'), {
        name: 'List server variants',
        description: 'Retrieve all variants for a given server'
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
          description: 'Retrieve details for a specific server variant'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server:read'] }))
      .output(serverVariantPresenter)
      .do(async ctx => {
        return serverVariantPresenter.present({ serverVariant: ctx.serverVariant });
      })
  }
);
