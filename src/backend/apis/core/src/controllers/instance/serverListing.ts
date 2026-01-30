import { accessService } from '@metorial/module-access';
import { serverListingService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { apiGroup } from '../../middleware/apiGroup';
import { checkAccess } from '../../middleware/checkAccess';
import { serverListingPresenter, serverListingReadmePresenter } from '../../presenters';

export let serverListingGroup = apiGroup.use(async ctx => {
  if (!ctx.params.serverListingId) throw new Error('serverListingId is required');

  let instance = ctx.query.instance_id
    ? (
        await accessService.accessInstance({
          authInfo: ctx.auth,
          instanceId: ctx.query.instance_id
        })
      )?.instance
    : undefined;

  let serverListing = await serverListingService.getServerListingById({
    serverListingId: ctx.params.serverListingId,
    instance
  });

  return { serverListing };
});

export let serverListingController = Controller.create(
  {
    name: 'Server Listing',
    description:
      'Provides access to public server listings, including metadata, filtering, and ranking.',
    hideInDocs: true
  },
  {
    list: apiGroup
      .get(Path('server-listings', 'servers.listings.list'), {
        name: 'List server listings',
        description:
          'Returns a paginated list of server listings, filterable by collection, category, profile, or instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .outputList(serverListingPresenter)
      .query(
        'mt_2025_01_01_pulsar',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), { description: 'Search servers by name' }),
            collection_id: v.optional(
              v.union([v.array(v.string()), v.string()]),
              { description: 'Filter by collection ID(s)' }
            ),
            category_id: v.optional(
              v.union([v.array(v.string()), v.string()]),
              { description: 'Filter by category ID(s)' }
            ),
            profile_id: v.optional(
              v.union([v.array(v.string()), v.string()]),
              { description: 'Filter by profile ID(s)' }
            ),
            instance_id: v.optional(v.string(), { description: 'Filter by instance ID' }),
            order_by_rank: v.optional(v.boolean(), { description: 'Order results by rank' })
          })
        ),
        i => i
      )
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), { description: 'Search servers by name' }),
            collection_id: v.optional(
              v.union([v.array(v.string()), v.string()]),
              { description: 'Filter by collection ID(s)' }
            ),
            category_id: v.optional(
              v.union([v.array(v.string()), v.string()]),
              { description: 'Filter by category ID(s)' }
            ),
            profile_id: v.optional(
              v.union([v.array(v.string()), v.string()]),
              { description: 'Filter by profile ID(s)' }
            ),
            instance_id: v.optional(v.string(), { description: 'Filter by instance ID' }),
            order_by_rank: v.optional(v.boolean(), { description: 'Order results by rank' }),
            is_public: v.optional(v.boolean(), { description: 'Filter by public status' }),
            only_from_organization: v.optional(v.boolean(), { description: 'Only show servers from organization' })
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
          collectionIds: normalizeArrayParam(ctx.query.collection_id),
          categoryIds: normalizeArrayParam(ctx.query.category_id),
          profileIds: normalizeArrayParam(ctx.query.profile_id),

          isHostable: true,

          search: ctx.query.search,

          orderByRank: ctx.query.order_by_rank,
          isPublic: ctx.query.is_public,
          onlyFromOrganization: ctx.query.only_from_organization,

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
        description: 'Returns metadata and readme content for a specific server listing.'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .output(serverListingPresenter)
      .query(
        'default',
        v.object({
          instance_id: v.optional(v.string())
        })
      )
      .do(async ctx => {
        return serverListingPresenter.present({
          serverListing: ctx.serverListing,
          readme: ctx.serverListing.readme
        });
      }),

    readme: serverListingGroup
      .get(Path('server-listings/:serverListingId/readme', 'servers.listings.readme.get'), {
        name: 'Get server listing readme',
        description: 'Returns metadata and readme content for a specific server listing.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .output(serverListingReadmePresenter)
      .query(
        'default',
        v.object({
          instance_id: v.optional(v.string())
        })
      )
      .do(async ctx => {
        return serverListingReadmePresenter.present({
          serverListing: ctx.serverListing,
          readme: ctx.serverListing.readme
        });
      })
  }
);
