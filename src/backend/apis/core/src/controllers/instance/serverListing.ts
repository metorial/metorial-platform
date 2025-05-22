import { accessService } from '@metorial/module-access';
import { serverListingService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { apiGroup } from '../../middleware/apiGroup';
import { checkAccess } from '../../middleware/checkAccess';
import { serverListingPresenter } from '../../presenters';

export let serverListingGroup = apiGroup.use(async ctx => {
  if (!ctx.params.serverListingId) throw new Error('serverListingId is required');

  let serverListing = await serverListingService.getServerListingById({
    serverListingId: ctx.params.serverListingId
  });

  return { serverListing };
});

export let serverListingController = Controller.create(
  {
    name: 'Server Listing',
    description: 'Read and write server listing information'
  },
  {
    list: apiGroup
      .get(Path('server-listings', 'servers.listings.list'), {
        name: 'List server listings',
        description: 'List all server listings'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .outputList(serverListingPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            collection_ids: v.optional(v.union([v.array(v.string()), v.string()])),
            category_ids: v.optional(v.union([v.array(v.string()), v.string()])),
            profile_ids: v.optional(v.union([v.array(v.string()), v.string()])),
            instance_id: v.optional(v.string()),
            order_by_rank: v.optional(v.boolean())
          })
        )
      )
      .do(async ctx => {
        let instance = ctx.query.instance_id
          ? (
              await accessService.accessInstance({
                authInfo: ctx.auth,
                instanceId: ctx.query.instance_id
              })
            )?.instance
          : undefined;

        let paginator = await serverListingService.listServerListings({
          search: ctx.query.search,
          collectionIds: normalizeArrayParam(ctx.query.collection_ids),
          categoryIds: normalizeArrayParam(ctx.query.category_ids),
          profileIds: normalizeArrayParam(ctx.query.profile_ids),
          orderByRank: ctx.query.order_by_rank,
          instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverListing =>
          serverListingPresenter.present({ serverListing })
        );
      }),

    get: serverListingGroup
      .get(Path('server-listings/:serverListingId', 'servers.listings.get'), {
        name: 'Get server listing',
        description: 'Get the information of a specific server listing'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .output(serverListingPresenter)
      .do(async ctx => {
        return serverListingPresenter.present({
          serverListing: ctx.serverListing
        });
      })
  }
);
