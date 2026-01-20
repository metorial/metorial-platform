import { createHono } from '@metorial/hono';
import { subspaceSpecificationService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { specificationPresenter } from '../presenters';

export let specificationsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      z.intersection(
        paginatorSchema,
        z.object({
          provider_id: z.optional(z.string())
        })
      )
    ),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceSpecificationService.list({
        provider_id: normalizeArrayParam(query.provider_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, specificationPresenter));
    }
  )
  .get(':providerSpecificationId', async c => {
    let providerSpecificationId = c.req.param('providerSpecificationId');

    let specification = await subspaceSpecificationService.get({ providerSpecificationId });

    return c.json(specificationPresenter(specification));
  });
