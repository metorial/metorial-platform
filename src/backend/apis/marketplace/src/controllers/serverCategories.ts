import { createHono } from '@metorial/hono';
import { serverListingCategoryService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { serverCategoryPresenter } from '../presenters/serverCategory';

export let serverCategoriesController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.query();

    let paginator = await serverListingCategoryService.listServerListingCategories({});
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, serverCategoryPresenter));
  })
  .get(':categoryId', async c => {
    let category = await serverListingCategoryService.getServerListingCategoryById({
      serverListingCategoryId: c.req.param('categoryId')
    });

    return c.json(await serverCategoryPresenter(category));
  });
