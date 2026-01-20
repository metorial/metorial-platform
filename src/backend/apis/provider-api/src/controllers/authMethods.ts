import { createHono } from '@metorial/hono';
import { subspaceAuthMethodService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { authMethodPresenter } from '../presenters';

export let authMethodsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string()),
          provider_specification_id: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceAuthMethodService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_specification_id: normalizeArrayParam(query.provider_specification_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, authMethodPresenter));
    }
  )
  .get(':providerAuthMethodId', async c => {
    let providerAuthMethodId = c.req.param('providerAuthMethodId');

    let authMethod = await subspaceAuthMethodService.get({ providerAuthMethodId });

    return c.json(authMethodPresenter(authMethod));
  });
