import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  storeItemListPresenter,
  storePermissionsPresenter,
  storePresenter
} from '../../../presenters';
import { dateFilterSchema, mapCargoListQuery, stringArrayFilterSchema } from './_listFilters';

let storeAccessSchema = v.enumOf(['private', 'public_read', 'public_write']);

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
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .outputList(storePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Filter by store ID'),
            created_at: dateFilterSchema('Filter by creation time'),
            update_at: dateFilterSchema('Filter by update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await storeService.listStores({
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });
        let list = await paginator.run(
          mapCargoListQuery(ctx.query, {
            arrays: {
              id: 'storeIds'
            },
            dates: {
              created_at: 'createdAt',
              update_at: 'updatedAt'
            }
          })
        );

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
          name: v.string(),
          access: v.optional(storeAccessSchema),
          template_id: v.optional(v.string()),
          parent_id: v.optional(v.string())
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
          ...getInstanceCargoAccess(ctx),
          input: {
            name: ctx.body.name,
            access: ctx.body.access,
            templateId: ctx.body.template_id,
            parentId: ctx.body.parent_id
          }
        });

        return storePresenter.present({ store });
      }),

    get: storeGroup
      .get(instancePath('stores/:storeId', 'stores.get'), {
        name: 'Get store by ID',
        description: 'Retrieves a store by its ID.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .output(storePresenter)
      .do(async ctx => storePresenter.present({ store: ctx.store })),

    permissions: storeGroup
      .get(instancePath('stores/:storeId/permissions', 'stores.permissions.get'), {
        name: 'Get store permissions',
        description:
          'Returns the effective Cargo permissions for the current actor on a specific store.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .output(storePermissionsPresenter)
      .do(async ctx => {
        let permissions = await storeService.getStorePermissions({
          storeId: ctx.store.id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });

        return storePermissionsPresenter.present({ permissions });
      }),

    update: storeGroup
      .patch(instancePath('stores/:storeId', 'stores.update'), {
        name: 'Update store by ID',
        description: 'Updates a specific store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          access: v.optional(storeAccessSchema)
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
            name: ctx.body.name,
            access: ctx.body.access
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
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'consumer#instance.store:write']
        })
      )
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
      .output(storeItemListPresenter)
      .do(async ctx => {
        let items = await storeService.modifyStoreItems({
          store: ctx.store,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx),
          operations: ctx.body.operations
        });

        return storeItemListPresenter.present({ storeItems: items.map(i => i.item) });
      })
  }
);
