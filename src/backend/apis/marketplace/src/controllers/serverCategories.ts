import { createHono } from '@metorial/hono';
import {
  subspacePublicProviderListingCategoryService,
  type SubspaceProviderListingCategory
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { providerCategoryPresenter } from '../../../core/src/presenters';
import { toPaginationQuery } from '../lib/paginationQuery';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';

let presentProviderCategory = async (category: SubspaceProviderListingCategory) =>
  await providerCategoryPresenter
    .present({ category })({
      apiVersion: 'mt_2025_01_01_dashboard',
      accessType: 'instance_publishable'
    })
    .run({});

export let serverCategoriesController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');

    let paginator = await subspacePublicProviderListingCategoryService.list({});
    let list = await paginator.run(toPaginationQuery(query));

    return c.json(await Paginator.presentLight(list, presentProviderCategory));
  })
  .get(':categoryId', async c => {
    let category = await subspacePublicProviderListingCategoryService.get({
      providerListingCategoryId: c.req.param('categoryId')
    });

    return c.json(await presentProviderCategory(category));
  });
