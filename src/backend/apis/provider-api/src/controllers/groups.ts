import { createHono } from '@metorial/hono';
import { subspaceGroupService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { groupPresenter } from '../presenters';

export let groupsController = createHono()
  .get(
    '',
    useValidation('query', paginatorSchema),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceGroupService.list({});

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, groupPresenter));
    }
  )
  .get(':providerGroupId', async c => {
    let providerGroupId = c.req.param('providerGroupId');

    let group = await subspaceGroupService.get({ providerGroupId });

    return c.json(groupPresenter(group));
  })
  .post(
    '',
    useValidation(
      'json',
      z.object({
        name: z.string(),
        description: z.optional(z.string()),
        slug: z.string()
      })
    ),
    async c => {
      let body = await c.req.json();

      let group = await subspaceGroupService.create({
        name: body.name,
        description: body.description,
        slug: body.slug
      });

      return c.json(groupPresenter(group), 201);
    }
  )
  .patch(
    ':providerGroupId',
    useValidation(
      'json',
      z.object({
        name: z.optional(z.string()),
        description: z.optional(z.string()),
        slug: z.optional(z.string())
      })
    ),
    async c => {
      let providerGroupId = c.req.param('providerGroupId');
      let body = await c.req.json();

      let group = await subspaceGroupService.update({
        providerGroupId,
        name: body.name,
        description: body.description,
        slug: body.slug
      });

      return c.json(groupPresenter(group));
    }
  );
