import { createHono } from '@metorial/hono';
import { subspaceVersionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { versionPresenter } from '../presenters';

export let versionsController = createHono()
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

      let paginator = await subspaceVersionService.list({
        provider_id: normalizeArrayParam(query.provider_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, versionPresenter));
    }
  )
  .get(':providerVersionId', async c => {
    let providerVersionId = c.req.param('providerVersionId');

    let version = await subspaceVersionService.get({ providerVersionId });

    return c.json(versionPresenter(version));
  });
