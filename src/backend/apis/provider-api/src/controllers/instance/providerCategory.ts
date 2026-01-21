import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingCategoryService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { categoryPresenter } from '../../presenters';
import { SubspaceCategory } from '../../presenters/types';

export let providerCategoryGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerCategoryId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerCategoryId is required',
        description: 'The providerCategoryId path parameter is required.'
      })
    );
  }

  let category = await subspaceProviderListingCategoryService.get({
    instance: ctx.instance,
    providerListingCategoryId: ctx.params.providerCategoryId
  });

  return { category };
});

export let providerCategoryController = Controller.create(
  {
    name: 'Provider Categories',
    description: 'Browse provider categories in the catalog.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-categories', 'providerCategories.list'), {
        name: 'List provider categories',
        description: 'Returns a paginated list of provider categories.'
      })
      .outputList(categoryPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspaceProviderListingCategoryService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, category =>
          categoryPresenter.present({ category: category as SubspaceCategory })
        );
      }),

    get: providerCategoryGroup
      .get(providerPath('provider-categories/:providerCategoryId', 'providerCategories.get'), {
        name: 'Get provider category',
        description: 'Retrieves a specific provider category by ID.'
      })
      .output(categoryPresenter)
      .do(async ctx => {
        return categoryPresenter.present({ category: ctx.category });
      })
  }
);
