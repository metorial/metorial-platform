import { createHono } from '@metorial/hono';
import { subspaceProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { providerPresenter } from '../presenters';

export let providersController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          publisher_id: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceProviderService.list({
        publisher_id: normalizeArrayParam(query.publisher_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, providerPresenter));
    }
  )
  .get(':providerId', async c => {
    let providerId = c.req.param('providerId');

    let provider = await subspaceProviderService.get({ providerId });

    return c.json(providerPresenter(provider));
  });
