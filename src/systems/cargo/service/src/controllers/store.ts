import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeItemPresenter, storePresenter } from '../presenters';
import { storeService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let storeApp = tenantApp.use(async ctx => {
  let storeId = ctx.body.storeId;
  if (!storeId) throw new Error('Store ID is required');

  let store = await storeService.getStoreById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    storeId
  });

  return { store };
});

let storeItemOperationSchema = v.object({
  type: v.optional(v.enumOf(['add', 'modify', 'remove'])),
  itemId: v.optional(v.string()),
  fileId: v.optional(v.string()),
  documentId: v.optional(v.string()),
  path: v.optional(v.string())
});

export let storeController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.optional(v.string()),
        name: v.string()
      })
    )
    .do(async ctx => {
      let store = await storeService.createStore({
        tenant: ctx.tenant,
        environment: ctx.environment,
        input: {
          id: ctx.input.storeId,
          name: ctx.input.name
        }
      });

      return storePresenter(store);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await storeService.listStores({
        tenant: ctx.tenant,
        environment: ctx.environment
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, storePresenter);
    }),

  get: storeApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.string()
      })
    )
    .do(async ctx => storePresenter(ctx.store)),

  update: storeApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.string(),
        name: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let store = await storeService.updateStore({
        store: ctx.store,
        input: {
          name: ctx.input.name
        }
      });

      return storePresenter(store);
    }),

  delete: storeApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.string()
      })
    )
    .do(async ctx => {
      let store = await storeService.deleteStore({
        store: ctx.store
      });

      return storePresenter(store);
    }),

  modifyItems: storeApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.string(),
        operations: v.array(storeItemOperationSchema)
      })
    )
    .do(async ctx =>
      (
        await storeService.modifyStoreItems({
          tenant: ctx.tenant,
          environment: ctx.environment,
          store: ctx.store,
          operations: ctx.input.operations as any
        })
      ).map(result => ({
        type: result.type,
        item: storeItemPresenter(result.item)
      }))
    )
});
