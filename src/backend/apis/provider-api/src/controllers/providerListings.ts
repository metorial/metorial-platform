import { createHono } from '@metorial/hono';
import { subspaceProviderListingService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam, stringToBoolean } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { providerListingPresenter } from '../presenters';

export let providerListingsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          search: z.optional(z.string()),
          provider_category_id: z.optional(z.string()),
          provider_collection_id: z.optional(z.string()),
          provider_group_id: z.optional(z.string()),
          publisher_id: z.optional(z.string()),
          is_public: z.optional(z.string()),
          is_verified: z.optional(z.string()),
          is_official: z.optional(z.string()),
          is_metorial: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceProviderListingService.list({
        search: query.search,
        provider_category_id: normalizeArrayParam(query.provider_category_id),
        provider_collection_id: normalizeArrayParam(query.provider_collection_id),
        provider_group_id: normalizeArrayParam(query.provider_group_id),
        publisher_id: normalizeArrayParam(query.publisher_id),
        is_public: stringToBoolean(query.is_public),
        is_verified: stringToBoolean(query.is_verified),
        is_official: stringToBoolean(query.is_official),
        is_metorial: stringToBoolean(query.is_metorial)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, providerListingPresenter));
    }
  )
  .get(':providerId', async c => {
    let providerId = c.req.param('providerId');

    let listing = await subspaceProviderListingService.get({ providerId });

    return c.json(providerListingPresenter(listing));
  });
