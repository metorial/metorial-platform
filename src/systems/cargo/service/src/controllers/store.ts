import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeItemPresenter, storePermissionsPresenter, storePresenter } from '../presenters';
import { storeService } from '../services';
import { app } from './_app';
import { storePermissionsSchema } from './document';
import { tenantApp } from './tenant';

export let storeAccessSchema = v.enumOf(['private', 'public_read', 'public_write']);
export let storeCloneTypeSchema = v.enumOf(['sync_until_change', 'duplicate']);

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
        name: v.string(),
        access: v.optional(storeAccessSchema),
        templateId: v.optional(v.string()),
        parentId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      if (ctx.input.templateId && ctx.input.parentId) {
        throw new ServiceError(
          badRequestError({
            message: 'templateId and parentId are mutually exclusive'
          })
        );
      }

      let store = ctx.input.templateId
        ? await storeService.createStoreFromTemplate({
            tenant: ctx.tenant,
            environment: ctx.environment,
            input: {
              templateId: ctx.input.templateId,
              id: ctx.input.storeId,
              name: ctx.input.name,
              access: ctx.input.access
            }
          })
        : ctx.input.parentId
          ? await storeService.cloneStore({
              tenant: ctx.tenant,
              environment: ctx.environment,
              store: await storeService.getStoreById({
                tenant: ctx.tenant,
                environment: ctx.environment,
                storeId: ctx.input.parentId
              }),
              input: {
                id: ctx.input.storeId,
                name: ctx.input.name,
                access: ctx.input.access
              }
            })
        : await storeService.createStore({
            tenant: ctx.tenant,
            environment: ctx.environment,
            input: {
              id: ctx.input.storeId,
              name: ctx.input.name,
              access: ctx.input.access
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
          environmentId: v.string(),
          actorId: v.optional(v.string()),
          defaultPermissions: v.optional(storePermissionsSchema),
          overridePermissions: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await storeService.listStores({
        tenant: ctx.tenant,
        environment: ctx.environment,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
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
        storeId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      storePresenter(
        await storeService.getStoreById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          storeId: ctx.input.storeId,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      )
    ),

  getPermissions: storeApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      storePermissionsPresenter(
        await storeService.getStorePermissions({
          tenant: ctx.tenant,
          environment: ctx.environment,
          store: ctx.store,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      )
    ),

  update: storeApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.string(),
        name: v.optional(v.string()),
        access: v.optional(storeAccessSchema),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let store = await storeService.updateStore({
        tenant: ctx.tenant,
        environment: ctx.environment,
        store: ctx.store,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions,
        input: {
          name: ctx.input.name,
          access: ctx.input.access
        }
      });

      return storePresenter(store);
    }),

  clone: storeApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeId: v.string(),
        targetStoreId: v.optional(v.string()),
        name: v.optional(v.string()),
        access: v.optional(storeAccessSchema),
        cloneType: v.optional(storeCloneTypeSchema),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let store = await storeService.cloneStore({
        tenant: ctx.tenant,
        environment: ctx.environment,
        store: ctx.store,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions,
        input: {
          id: ctx.input.targetStoreId,
          name: ctx.input.name,
          access: ctx.input.access,
          cloneType: ctx.input.cloneType
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
        storeId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let store = await storeService.deleteStore({
        tenant: ctx.tenant,
        environment: ctx.environment,
        store: ctx.store,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
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
        operations: v.array(storeItemOperationSchema),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      (
        await storeService.modifyStoreItems({
          tenant: ctx.tenant,
          environment: ctx.environment,
          store: ctx.store,
          operations: ctx.input.operations as any,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      ).map(result => ({
        type: result.type,
        item: storeItemPresenter(result.item)
      }))
    )
});
