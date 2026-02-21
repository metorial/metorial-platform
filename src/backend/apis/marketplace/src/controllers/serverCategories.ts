import { createHono } from '@metorial/hono';
import { subspacePublicProviderListingCategoryService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { toPaginationQuery } from '../lib/paginationQuery';
import { paginatorSchema } from '../lib/paginatorSchema';
import { presentProviderCategory } from '../presenters/provider';
import { useValidation } from '../lib/validator';

export let serverCategoriesController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');

    let paginator = await subspacePublicProviderListingCategoryService.list({});
    let list = await paginator.run(toPaginationQuery(query));

    return c.json(
      await Paginator.presentLight(list, category => presentProviderCategory(category))
    );
  })
  .get(':categoryId', async c => {
    let category = await subspacePublicProviderListingCategoryService.get({
      providerListingCategoryId: c.req.param('categoryId')
    });

    return c.json(presentProviderCategory(category));
  });
