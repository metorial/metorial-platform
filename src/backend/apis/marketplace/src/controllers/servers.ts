import { createHono } from '@metorial/hono';
import {
  serverCapabilitiesService,
  serverListingService,
  serverService,
  serverVariantService,
  serverVersionService
} from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { serverCapabilitiesPresenter } from '../presenters/serverCapabilities';
import { serverListingPresenter } from '../presenters/serverListing';
import { serverVariantPresenter } from '../presenters/serverVariant';
import { serverVersionPresenter } from '../presenters/serverVersion';

export let serversController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          search: z.optional(z.string()),
          collectionIds: z.optional(z.string()),
          categoryIds: z.optional(z.string()),
          profileIds: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      console.log('query', query);

      let paginator = await serverListingService.listServerListings({
        search: query.search,

        collectionIds: query.collectionIds?.split(','),
        categoryIds: query.categoryIds?.split(','),
        profileIds: query.profileIds?.split(','),

        orderByRank: true
      });
      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, serverListingPresenter));
    }
  )
  .get(':vendorSlug/:serverSlug', async c => {
    let listing = await serverListingService.getServerListingById({
      serverListingId: `${c.req.param('vendorSlug')}/${c.req.param('serverSlug')}`
    });

    return c.json(await serverListingPresenter(listing));
  })
  .get(':vendorSlug/:serverSlug/capabilities', async c => {
    let listing = await serverListingService.getServerListingById({
      serverListingId: `${c.req.param('vendorSlug')}/${c.req.param('serverSlug')}`
    });

    let [capabilities] = await serverCapabilitiesService.getManyServerCapabilities({
      serverIds: [listing.server.id]
    });

    if (!capabilities) return c.json(null);

    return c.json(await serverCapabilitiesPresenter(capabilities));
  })
  .get(
    ':vendorSlug/:serverSlug/variants',
    useValidation('query', paginatorSchema),
    async c => {
      let query = c.req.query();

      let server = await serverService.getServerById({
        serverId: `${c.req.param('vendorSlug')}/${c.req.param('serverSlug')}`
      });

      let paginator = await serverVariantService.listServerVariants({
        server
      });
      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, serverVariantPresenter));
    }
  )
  .get(':vendorSlug/:serverSlug/variants/:variantId', async c => {
    let server = await serverService.getServerById({
      serverId: `${c.req.param('vendorSlug')}/${c.req.param('serverSlug')}`
    });

    let collection = await serverVariantService.getServerVariantById({
      serverVariantId: c.req.param('variantId'),
      server
    });

    return c.json(await serverVariantPresenter(collection));
  })
  .get(
    ':vendorSlug/:serverSlug/versions',
    useValidation('query', paginatorSchema),
    async c => {
      let query = c.req.query();

      let server = await serverService.getServerById({
        serverId: `${c.req.param('vendorSlug')}/${c.req.param('serverSlug')}`
      });

      let paginator = await serverVersionService.listServerVersions({
        server
      });
      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, serverVersionPresenter));
    }
  )
  .get(':vendorSlug/:serverSlug/versions/:versionId', async c => {
    let server = await serverService.getServerById({
      serverId: `${c.req.param('vendorSlug')}/${c.req.param('serverSlug')}`
    });

    let collection = await serverVersionService.getServerVersionById({
      serverVersionId: c.req.param('versionId'),
      server
    });

    return c.json(await serverVersionPresenter(collection));
  });
