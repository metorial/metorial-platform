import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeItemService } from '@metorial-cargo/module-store';
import { storeItemPresenter } from '../presenters';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
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

let storeItemTypeSchema = v.enumOf(['file', 'document', 'directory']);

export let storeItemController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          itemIds: v.optional(v.array(v.string())),
          storeId: v.string(),
          fileIds: v.optional(v.array(v.string())),
          documentIds: v.optional(v.array(v.string())),
          referenceIds: v.optional(v.array(v.string())),
          directoryIds: v.optional(v.array(v.string())),
          parentDirectoryIds: v.optional(v.array(v.string())),
          lastModifiedByActorIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema,
          types: v.optional(v.array(storeItemTypeSchema)),
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
        ids: ctx.input.itemIds,
        storeId: ctx.input.storeId,
        fileIds: ctx.input.fileIds,
        documentIds: ctx.input.documentIds,
        referenceIds: ctx.input.referenceIds,
        directoryIds: ctx.input.directoryIds,
        parentDirectoryIds: ctx.input.parentDirectoryIds,
        lastModifiedByActorIds: ctx.input.lastModifiedByActorIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt,
        types: ctx.input.types,
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
