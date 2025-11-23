import {
  serverListingCollectionService,
  serverListingService
} from '@metorial/module-catalog';
import { portalService } from '@metorial/module-portal';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { serverListingPresenter } from '../../presenters';
import { portalGroup } from './portal';

export let portalFeaturedServersController = Controller.create(
  {
    name: 'Portal Featured Servers',
    description: 'Connect Magic MCP Groups to Portals to control access to your marketplaces.'
  },
  {
    list: portalGroup
      .get(
        instancePath('portals/:portalId/featured-servers', 'portals.featuredServers.list'),
        {
          name: 'List Portal',
          description: 'Returns a paginated list of portals.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.featured_servers:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(serverListingPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await serverListingService.listServerListings({
          instance: ctx.instance,
          collectionIds: ctx.portal.featuredServersCollection
            ? [ctx.portal.featuredServersCollection.id]
            : []
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverListing =>
          serverListingPresenter.present({
            serverListing
          })
        );
      }),

    get: portalGroup
      .get(
        instancePath(
          'portals/:portalId/featured-servers/:serverListingId',
          'portals.featuredServers.get'
        ),
        {
          name: 'Get Portal Consumer Server Request by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.featured_servers:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(serverListingPresenter)
      .do(async ctx => {
        let serverListing = await serverListingService.getServerListingById({
          serverListingId: ctx.params.serverListingId,
          instance: ctx.instance
        });

        return serverListingPresenter.present({
          serverListing
        });
      }),

    addListing: portalGroup
      .post(
        instancePath(
          'portals/:portalId/featured-servers/add-listing',
          'portals.featuredServers.addListing'
        ),
        {
          name: 'Create Portal Consumer Server Request',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.featured_servers:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          server_id: v.string({
            name: 'server_id',
            description: 'The ID of the server to add to the featured servers collection'
          })
        })
      )
      .output(serverListingPresenter)
      .do(async ctx => {
        let serverListing = await serverListingService.getServerListingById({
          serverListingId: ctx.body.server_id,
          instance: ctx.instance
        });

        let collection = await portalService.ensureSurfaceFeaturedServersCollection({
          portal: ctx.portal
        });

        await serverListingCollectionService.addServerToCollection({
          serverListingCollection: collection,
          serverListing
        });

        serverListing = await serverListingService.getServerListingById({
          serverListingId: ctx.body.server_id,
          instance: ctx.instance
        });

        return serverListingPresenter.present({ serverListing });
      }),

    removeListing: portalGroup
      .post(
        instancePath(
          'portals/:portalId/featured-servers/remove-listing',
          'portals.featuredServers.removeListing'
        ),
        {
          name: 'Remove Portal Consumer Server Request',
          description: 'Removes a server from the featured servers collection.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.featured_servers:write']
        })
      )
      .use(hasFlags(['paid-portals']))
      .body(
        'default',
        v.object({
          server_id: v.string({
            name: 'server_id',
            description: 'The ID of the server to remove from the featured servers collection'
          })
        })
      )
      .output(serverListingPresenter)
      .do(async ctx => {
        let serverListing = await serverListingService.getServerListingById({
          serverListingId: ctx.body.server_id,
          instance: ctx.instance
        });

        let collection = await portalService.ensureSurfaceFeaturedServersCollection({
          portal: ctx.portal
        });

        await serverListingCollectionService.removeServerFromCollection({
          serverListingCollection: collection,
          serverListing
        });

        serverListing = await serverListingService.getServerListingById({
          serverListingId: ctx.body.server_id,
          instance: ctx.instance
        });

        return serverListingPresenter.present({ serverListing });
      })
  }
);
