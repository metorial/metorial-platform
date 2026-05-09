import { Paginator } from '@lowerdeck/pagination';
import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { storeService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../lib/cargoAccess';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { storeItemPresenter, storePresenter } from '../../presenters';

let assertStoreCrudAllowed = (ctx: Parameters<typeof hasInstanceConsumerAccess>[0]) => {
  if (hasInstanceConsumerAccess(ctx)) {
    throw new ServiceError(
      forbiddenError({
        message: 'Consumers cannot create, update, or delete stores'
      })
    );
  }
};

export let storeGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.storeId) {
    throw new Error('storeId is required');
  }

  let store = await storeService.getStoreById({
    storeId: ctx.params.storeId,
    owner: {
      type: 'instance',
      instance: ctx.instance,
      organization: ctx.organization
    },
    ...getInstanceCargoAccess(ctx)
  });

  return { store };
});

export let storeController = Controller.create(
  {
    name: 'Stores',
    description: 'Create and manage instance stores backed by Cargo.'
  },
  {
    list: instanceGroup
      .get(instancePath('stores', 'stores.list'), {
        name: 'List stores',
        description: 'Returns a paginated list of stores owned by the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .outputList(storePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await storeService.listStores({
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, store => storePresenter.present({ store }));
      }),

    create: instanceGroup
      .post(instancePath('stores', 'stores.create'), {
        name: 'Create store',
        description: 'Creates a new store for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          name: v.string()
        })
      )
      .output(storePresenter)
      .do(async ctx => {
        assertStoreCrudAllowed(ctx);

        let store = await storeService.createStore({
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          input: {
            name: ctx.body.name
          }
        });

        return storePresenter.present({ store });
      }),

    get: storeGroup
      .get(instancePath('stores/:storeId', 'stores.get'), {
        name: 'Get store by ID',
        description: 'Retrieves a store by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .output(storePresenter)
      .do(async ctx => storePresenter.present({ store: ctx.store })),

    update: storeGroup
      .patch(instancePath('stores/:storeId', 'stores.update'), {
        name: 'Update store by ID',
        description: 'Updates a specific store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string())
        })
      )
      .output(storePresenter)
      .do(async ctx => {
        assertStoreCrudAllowed(ctx);

        let store = await storeService.updateStore({
          store: ctx.store,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx),
          input: {
            name: ctx.body.name
          }
        });

        return storePresenter.present({ store });
      }),

    delete: storeGroup
      .delete(instancePath('stores/:storeId', 'stores.delete'), {
        name: 'Delete store by ID',
        description: 'Deletes a specific store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .output(storePresenter)
      .do(async ctx => {
        assertStoreCrudAllowed(ctx);

        let store = await storeService.deleteStore({
          store: ctx.store,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });

        return storePresenter.present({ store });
      }),

    modifyItems: storeGroup
      .patch(instancePath('stores/:storeId/items', 'stores.items.modify'), {
        name: 'Modify store items',
        description: 'Applies bulk item operations to a specific store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          operations: v.array(
            v.object({
              type: v.optional(v.enumOf(['add', 'modify', 'remove'])),
              itemId: v.optional(v.string()),
              fileId: v.optional(v.string()),
              documentId: v.optional(v.string()),
              path: v.optional(v.string())
            })
          )
        })
      )
      .do(
        async ctx =>
          await Promise.all(
            (
              await storeService.modifyStoreItems({
                store: ctx.store,
                owner: {
                  type: 'instance',
                  instance: ctx.instance,
                  organization: ctx.organization
                },
                ...getInstanceCargoAccess(ctx),
                operations: ctx.body.operations
              })
            ).map(async result => ({
              type: result.type,
              item: await storeItemPresenter
                .present({ storeItem: result.item })(ctx as any)
                .run()
            }))
          )
      )
  }
);
