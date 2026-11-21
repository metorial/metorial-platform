import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeService } from '@metorial/module-store';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  storeItemListPresenter,
  storePermissionsPresenter,
  storePresenter
} from '@metorial/presenters';
import { stringArrayFilterSchema } from './_listFilters';

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
    ...(await getInstanceCargoAccess(ctx))
  });

  return { store };
});

export let storeController = Controller.create(
  {
    name: 'Stores',
    description:
      'A store is a shared collection of files and documents. Participants get read or write access to its contents.'
  },
  {
    list: instanceGroup
      .get(instancePath('stores', 'stores.list'), {
        name: 'List stores',
        description: 'Returns a paginated list of stores.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .outputList(storePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Only return stores with one of these IDs.'),
            created_at: dateFilterValidator('store creation time'),
            updated_at: dateFilterValidator('store last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await storeService.listStores({
          ...(await getInstanceCargoAccess(ctx)),
          ids: normalizeArrayParam(ctx.query.id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, store => storePresenter.present({ store }));
      }),

    create: instanceGroup
      .post(instancePath('stores', 'stores.create'), {
        name: 'Create store',
        description: 'Creates a store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ description: 'Display name for the store.' }),
          access: v.optional(storeAccessSchema, {
            description:
              'Who else can access the store: `private`, `public_read`, or `public_write`.'
          }),
          template_id: v.optional(
            v.string({
              description:
                'Template to create the store from, by ID. Cannot be combined with `parent_id`.'
            })
          ),
          parent_id: v.optional(
            v.string({
              description: 'Store to copy, by ID. Cannot be combined with `template_id`.'
            })
          )
        })
      )
      .output(storePresenter)
      .do(async ctx => {
        assertStoreCrudAllowed(ctx);

        if (ctx.body.template_id && ctx.body.parent_id) {
          throw new ServiceError(
            badRequestError({
              message: 'A store can only be created from either a template or a parent store.'
            })
          );
        }

        let access = await getInstanceCargoAccess(ctx);
        let store = ctx.body.template_id
          ? await storeService.createStoreFromTemplate({
              project: access.project,
              instance: access.instance,
              auditScope: access.auditScope,
              authorization: access.authorization,
              input: {
                templateId: ctx.body.template_id,
                name: ctx.body.name,
                access: ctx.body.access,
                actor: access.actor
              }
            })
          : ctx.body.parent_id
            ? await storeService.cloneStore({
                ...access,
                store: await storeService.getStoreById({
                  ...access,
                  storeId: ctx.body.parent_id
                }),
                input: {
                  name: ctx.body.name,
                  access: ctx.body.access
                }
              })
            : await storeService.createStore({
                project: access.project,
                instance: access.instance,
                auditScope: access.auditScope,
                input: {
                  name: ctx.body.name,
                  access: ctx.body.access,
                  actor: access.actor
                }
              });

        return storePresenter.present({ store });
      }),

    get: storeGroup
      .get(instancePath('stores/:storeId', 'stores.get'), {
        name: 'Get store',
        description: 'Retrieves a store.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .output(storePresenter)
      .do(async ctx => storePresenter.present({ store: ctx.store })),

    permissions: storeGroup
      .get(instancePath('stores/:storeId/permissions', 'stores.permissions.get'), {
        name: 'Get store permissions',
        description: 'Returns what the caller can do with a store.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .output(storePermissionsPresenter)
      .do(async ctx => {
        let permissions = await storeService.getStorePermissions({
          store: ctx.store,
          ...(await getInstanceCargoAccess(ctx))
        });

        return storePermissionsPresenter.present({ permissions });
      }),

    update: storeGroup
      .patch(instancePath('stores/:storeId', 'stores.update'), {
        name: 'Update store',
        description: 'Updates a store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'Display name for the store.' })),
          access: v.optional(storeAccessSchema, {
            description:
              'Who else can access the store: `private`, `public_read`, or `public_write`.'
          })
        })
      )
      .output(storePresenter)
      .do(async ctx => {
        assertStoreCrudAllowed(ctx);

        let store = await storeService.updateStore({
          store: ctx.store,
          ...(await getInstanceCargoAccess(ctx)),
          input: {
            name: ctx.body.name,
            access: ctx.body.access
          }
        });

        return storePresenter.present({ store });
      }),

    delete: storeGroup
      .delete(instancePath('stores/:storeId', 'stores.delete'), {
        name: 'Delete store',
        description: 'Deletes a store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .output(storePresenter)
      .do(async ctx => {
        assertStoreCrudAllowed(ctx);

        let store = await storeService.deleteStore({
          store: ctx.store,
          ...(await getInstanceCargoAccess(ctx))
        });

        return storePresenter.present({ store });
      }),

    modifyItems: storeGroup
      .patch(instancePath('stores/:storeId/items', 'stores.items.modify'), {
        name: 'Modify store items',
        description: 'Applies a list of add, modify, and remove operations to a store.'
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
              type: v.optional(v.enumOf(['add', 'modify', 'remove']), {
                description: 'Operation to perform.'
              }),
              itemId: v.optional(
                v.string({ description: 'Store item the operation applies to, by ID.' })
              ),
              fileId: v.optional(
                v.string({ description: 'File to add to the store, by ID.' })
              ),
              documentId: v.optional(
                v.string({ description: 'Document to add to the store, by ID.' })
              ),
              path: v.optional(v.string({ description: 'Path the operation applies to.' }))
            }),
            { description: 'Operations to apply to the store.' }
          )
        })
      )
      .output(storeItemListPresenter)
      .do(async ctx => {
        let items = await storeService.modifyStoreItems({
          store: ctx.store,
          ...(await getInstanceCargoAccess(ctx)),
          operations: ctx.body.operations
        });

        return storeItemListPresenter.present({ storeItems: items.map(i => i.item) });
      })
  }
);
