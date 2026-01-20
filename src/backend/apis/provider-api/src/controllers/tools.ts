import { createHono } from '@metorial/hono';
import { subspaceToolService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { normalizeArrayParam } from '../lib/normalizeArrayParam';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { toolPresenter } from '../presenters';

export let toolsController = createHono()
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

      let paginator = await subspaceToolService.list({
        provider_id: normalizeArrayParam(query.provider_id),
        provider_specification_id: normalizeArrayParam(query.provider_specification_id)
      });

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, toolPresenter));
    }
  )
  .get(':providerToolId', async c => {
    let providerToolId = c.req.param('providerToolId');

    let tool = await subspaceToolService.get({ providerToolId });

    return c.json(toolPresenter(tool));
  });
