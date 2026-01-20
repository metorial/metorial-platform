import { createHono } from '@metorial/hono';
import { subspaceCategoryService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { categoryPresenter } from '../presenters';

export let categoriesController = createHono()
  .get(
    '',
    useValidation('query', paginatorSchema),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceCategoryService.list({});

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, categoryPresenter));
    }
  )
  .get(':providerCategoryId', async c => {
    let providerCategoryId = c.req.param('providerCategoryId');

    let category = await subspaceCategoryService.get({ providerCategoryId });

    return c.json(categoryPresenter(category));
  });
