import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingCategoryService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerCategoryPresenter } from '../../presenters';

export let providerCategoryGroup = instanceGroup.use(async ctx => {
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
    description: "A category groups providers by function like 'Developer Tools' or 'ERPs'."
  },
  {
    list: instanceGroup
      .get(instancePath('provider-categories', 'providerCategories.list'), {
        name: 'List provider categories',
        description: 'Returns a paginated list of provider categories.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerCategoryPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by category ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_listing_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider listing ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderListingCategoryService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerListingIds: normalizeArrayParam(ctx.query.provider_listing_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, category =>
          providerCategoryPresenter.present({
            category
          })
        );
      }),

    get: providerCategoryGroup
      .get(instancePath('provider-categories/:providerCategoryId', 'providerCategories.get'), {
        name: 'Get provider category',
        description: 'Retrieves a specific provider category by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerCategoryPresenter)
      .do(async ctx => {
        return providerCategoryPresenter.present({ category: ctx.category });
      })
  }
);
