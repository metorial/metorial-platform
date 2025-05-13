import { serverListingService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { apiGroup } from '../../middleware/apiGroup';
import { instancePath } from '../../middleware/instanceGroup';
import { serverListingPresenter } from '../../presenters';

export let serverListingGroup = apiGroup.use(async ctx => {
  let serverListing = await serverListingService.getServerListingById({
    serverListingId: ctx.params.serverListingId
  });

  return { serverListing };
});

export let serverListingController = Controller.create(
  {
    name: 'Server Listing',
    description: 'Read and write server version information'
  },
  {
    list: apiGroup
      .get(instancePath('server-listings', 'servers.listings.list'), {
        name: 'List server versions',
        description: 'List all server versions'
      })
      .outputList(serverListingPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            collection_ids: v.optional(v.array(v.string())),
            category_ids: v.optional(v.array(v.string())),
            profile_ids: v.optional(v.array(v.string()))
          })
        )
      )
      .do(async ctx => {
        let paginator = await serverListingService.listServerListings({
          search: ctx.query.search,
          collectionIds: ctx.query.collection_ids,
          categoryIds: ctx.query.category_ids,
          profileIds: ctx.query.profile_ids
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverListing =>
          serverListingPresenter.present({ serverListing })
        );
      }),

    get: serverListingGroup
      .get(instancePath('server-listings/:serverListingId', 'servers.listings.get'), {
        name: 'Get server version',
        description: 'Get the information of a specific server version'
      })
      .output(serverListingPresenter)
      .do(async ctx => {
        return serverListingPresenter.present({
          serverListing: ctx.serverListing
        });
      })
  }
);
