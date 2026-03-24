import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerListingCategoryService } from '@metorial-subspace/module-catalog';
import { providerListingCategoryPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantOptionalApp } from './tenant';

export let providerListingCategoryApp = tenantOptionalApp.use(async ctx => {
  let providerListingCategoryId = ctx.body.providerListingCategoryId;
  if (!providerListingCategoryId) throw new Error('ProviderListingCategory ID is required');

  let providerListingCategory =
    await providerListingCategoryService.getProviderListingCategoryById({
      providerListingCategoryId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution
    });

  return { providerListingCategory };
});

export let providerListingCategoryController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerListingIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerListingCategoryService.listProviderListingCategories({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerListingIds: ctx.input.providerListingIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerListingCategoryPresenter);
    }),

  get: providerListingCategoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),
        providerListingCategoryId: v.string()
      })
    )
    .do(async ctx => providerListingCategoryPresenter(ctx.providerListingCategory)),

  upsert: providerListingCategoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),
        name: v.string(),
        slug: v.string(),
        description: v.string()
      })
    )
    .do(async ctx => {
      let providerListingCategory =
        await providerListingCategoryService.upsertProviderListingCategory({
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            slug: ctx.input.slug
          }
        });

      return providerListingCategoryPresenter(providerListingCategory);
    })
});
