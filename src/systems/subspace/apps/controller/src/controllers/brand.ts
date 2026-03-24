import { v } from '@lowerdeck/validation';
import { brandService, tenantService } from '@metorial-subspace/module-tenant';
import { brandPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';

export let brandApp = app.use(async ctx => {
  let brandId = ctx.body.brandId;
  if (!brandId) throw new Error('Brand ID is required');

  let brand = await brandService.getBrandById({ id: brandId });

  return { brand };
});

export let brandController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        image: v.typedAny<PrismaJson.EntityImage>('entity_image'),

        for: v.union([
          v.object({
            type: v.literal('identifier'),
            identifier: v.string()
          }),
          v.object({
            type: v.literal('tenant'),
            tenantId: v.string(),
            environmentId: v.string()
          })
        ])
      })
    )
    .do(async ctx => {
      let brand = await brandService.upsertBrand({
        input: {
          name: ctx.input.name,
          image: ctx.input.image,

          for:
            ctx.input.for.type === 'identifier'
              ? {
                  type: 'identifier',
                  identifier: ctx.input.for.identifier
                }
              : {
                  type: 'tenant',
                  tenant: await tenantService.getTenantById({
                    id: ctx.input.for.tenantId
                  })
                }
        }
      });
      return brandPresenter(brand);
    }),

  get: brandApp
    .handler()
    .input(
      v.object({
        brandId: v.string()
      })
    )
    .do(async ctx => brandPresenter(ctx.brand))
});
