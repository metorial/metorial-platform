import { createHono } from '@metorial/hono';
import {
  serverListingService,
  serverService,
  serverVariantService,
  serverVersionService
} from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
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

      let paginator = await serverListingService.listServerListings({
        search: query.search,
        collectionIds: query.collectionIds?.split(','),
        categoryIds: query.categoryIds?.split(','),
        profileIds: query.profileIds?.split(',')
      });
      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, serverListingPresenter));
    }
  )
  .get(':serverId', async c => {
    let collection = await serverListingService.getServerListingById({
      serverListingId: c.req.param('serverId')
    });

    return c.json(await serverListingPresenter(collection));
  })
  .get(':serverId/variants', useValidation('query', paginatorSchema), async c => {
    let query = c.req.query();

    let server = await serverService.getServerById({ serverId: c.req.param('serverId') });

    let paginator = await serverVariantService.listServerVariants({
      server
    });
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, serverVariantPresenter));
  })
  .get(':serverId/variants/:variantId', async c => {
    let server = await serverService.getServerById({ serverId: c.req.param('serverId') });

    let collection = await serverVariantService.getServerVariantById({
      serverVariantId: c.req.param('variantId'),
      server
    });

    return c.json(await serverVariantPresenter(collection));
  })
  .get(':serverId/versions', useValidation('query', paginatorSchema), async c => {
    let query = c.req.query();

    let server = await serverService.getServerById({ serverId: c.req.param('serverId') });

    let paginator = await serverVersionService.listServerVersions({
      server
    });
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, serverVersionPresenter));
  })
  .get(':serverId/versions/:versionId', async c => {
    let server = await serverService.getServerById({ serverId: c.req.param('serverId') });

    let collection = await serverVersionService.getServerVersionById({
      serverVersionId: c.req.param('versionId'),
      server
    });

    return c.json(await serverVersionPresenter(collection));
  });
