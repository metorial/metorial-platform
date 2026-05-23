import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { publisherService } from '@metorial-subspace/module-catalog';
import { publisherPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantOptionalApp } from './tenant';

export let publisherApp = tenantOptionalApp.use(async ctx => {
  let publisherId = ctx.body.publisherId;
  if (!publisherId) throw new Error('Publisher ID is required');

  let publisher = await publisherService.getPublisherById({
    publisherId,
    tenant: ctx.tenant
  });

  return { publisher };
});

export let publisherController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),

          search: v.optional(v.string()),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await publisherService.listPublishers({
        tenant: ctx.tenant,

        search: ctx.input.search,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, publisherPresenter);
    }),

  get: publisherApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),

        publisherId: v.string()
      })
    )
    .do(async ctx => publisherPresenter(ctx.publisher))
});
