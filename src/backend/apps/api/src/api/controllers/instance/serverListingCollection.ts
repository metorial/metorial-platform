import { serverListingCollectionService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { apiGroup } from '../../middleware/apiGroup';
import { checkAccess } from '../../middleware/checkAccess';
import { serverListingCollectionPresenter } from '../../presenters';

export let serverListingCollectionGroup = apiGroup.use(async ctx => {
  if (!ctx.params.serverListingCollectionId)
    throw new Error('serverListingCollectionId is required');

  let serverListingCollection =
    await serverListingCollectionService.getServerListingCollectionById({
      serverListingCollectionId: ctx.params.serverListingCollectionId
    });

  return { serverListingCollection };
});

export let serverListingCollectionController = Controller.create(
  {
    name: 'Server Collection',
    description: 'Read and write server version information'
  },
  {
    list: apiGroup
      .get(Path('server-listing-collections', 'servers.listings.collections.list'), {
        name: 'List server versions',
        description: 'List all server versions'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .outputList(serverListingCollectionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await serverListingCollectionService.listServerListingCollections({});

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, collection =>
          serverListingCollectionPresenter.present({ collection })
        );
      }),

    get: serverListingCollectionGroup
      .get(
        Path(
          'server-listing-collections/:serverListingCollectionId',
          'servers.listings.collections.get'
        ),
        {
          name: 'Get server version',
          description: 'Get the information of a specific server version'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .output(serverListingCollectionPresenter)
      .do(async ctx => {
        return serverListingCollectionPresenter.present({
          collection: ctx.serverListingCollection
        });
      })
  }
);
