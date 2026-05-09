import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeItemPresenter } from '../presenters';
import { storeItemService } from '../services';
import { app } from './_app';
import { storePermissionsSchema } from './document';
import { tenantApp } from './tenant';

export let storeItemApp = tenantApp.use(async ctx => {
  let itemId = ctx.body.itemId;
  if (!itemId) throw new Error('Store item ID is required');

  let item = await storeItemService.getStoreItemById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    itemId
  });

  return { item };
});

export let storeItemController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          storeId: v.optional(v.string()),
          fileId: v.optional(v.string()),
          documentId: v.optional(v.string()),
          actorId: v.optional(v.string()),
          defaultPermissions: v.optional(storePermissionsSchema),
          overridePermissions: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await storeItemService.listStoreItems({
        tenant: ctx.tenant,
        environment: ctx.environment,
        storeId: ctx.input.storeId,
        fileId: ctx.input.fileId,
        documentId: ctx.input.documentId,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, storeItemPresenter);
    }),

  get: storeItemApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        itemId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      storeItemPresenter(
        await storeItemService.getStoreItemById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          itemId: ctx.input.itemId,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      )
    )
});
