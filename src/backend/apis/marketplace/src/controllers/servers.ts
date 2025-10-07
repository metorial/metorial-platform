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

let normalizeSlug = (slug: string) => slug.replaceAll('---', '/').toLowerCase();

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
          profileIds: z.optional(z.string()),
          providerIds: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await serverListingService.listServerListings({
        search: query.search,

        collectionIds: query.collectionIds?.split(','),
        categoryIds: query.categoryIds?.split(','),
        profileIds: query.profileIds?.split(','),
        providerIds: query.providerIds?.split(','),

        orderByRank: true
      });
      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, serverListingPresenter));
    }
  )
  .get(':slug', async c => {
    let listing = await serverListingService.getServerListingById({
      serverListingId: normalizeSlug(c.req.param('slug'))
    });

    return c.json({
      ...(await serverListingPresenter(listing)),
      readme: listing.readme
    });
  })
  .get(':slug/capabilities', async c => {
    let listing = await serverListingService.getServerListingById({
      serverListingId: normalizeSlug(c.req.param('slug'))
    });

    let [capabilities] = await serverCapabilitiesService.getManyServerCapabilities({
      serverIds: [listing.server.id]
    });

    if (!capabilities) return c.json(null);

    return c.json(await serverCapabilitiesPresenter(capabilities));
  })
  .get(':slug/variants', useValidation('query', paginatorSchema), async c => {
    let query = c.req.query();

    let server = await serverService.getServerById({
      serverId: normalizeSlug(c.req.param('slug'))
    });

    let paginator = await serverVariantService.listServerVariants({
      server
    });
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, serverVariantPresenter));
  })
  .get(':slug/variants/:variantId', async c => {
    let server = await serverService.getServerById({
      serverId: normalizeSlug(c.req.param('slug'))
    });

    let collection = await serverVariantService.getServerVariantById({
      serverVariantId: c.req.param('variantId'),
      server
    });

    return c.json(await serverVariantPresenter(collection));
  })
  .get(':slug/versions', useValidation('query', paginatorSchema), async c => {
    let query = c.req.query();

    let server = await serverService.getServerById({
      serverId: normalizeSlug(c.req.param('slug'))
    });

    let paginator = await serverVersionService.listServerVersions({
      server
    });
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, serverVersionPresenter));
  })
  .get(':slug/versions/:versionId', async c => {
    let server = await serverService.getServerById({
      serverId: normalizeSlug(c.req.param('slug'))
    });

    let collection = await serverVersionService.getServerVersionById({
      serverVersionId: c.req.param('versionId'),
      server
    });

    return c.json(await serverVersionPresenter(collection));
  });
