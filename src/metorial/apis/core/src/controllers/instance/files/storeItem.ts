import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeItemService } from '@metorial/module-store';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { storeItemPresenter } from '@metorial/presenters';
import { stringArrayFilterSchema } from './_listFilters';
import { storeGroup } from './store';

export let storeItemGroup = storeGroup.use(async ctx => {
  if (!ctx.params.itemId) {
    throw new Error('itemId is required');
  }

  let storeItem = await storeItemService.getStoreItemById({
    itemId: ctx.params.itemId,
    ...(await getInstanceCargoAccess(ctx))
  });

  if (storeItem.store.id !== ctx.store.id) {
    throw new ServiceError(notFoundError('store.item', ctx.params.itemId));
  }

  return { storeItem };
});

export let storeItemController = Controller.create(
  {
    name: 'Store Items',
    description: 'A store item is a file, document, or directory in a store.'
  },
  {
    list: storeGroup
      .get(instancePath('stores/:storeId/items', 'stores.items.list'), {
        name: 'List store items',
        description: 'Returns a paginated list of items in a store.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .outputList(storeItemPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Only return items with one of these IDs.'),
            file_id: stringArrayFilterSchema('Only return items holding one of these files.'),
            document_id: stringArrayFilterSchema(
              'Only return items holding one of these documents.'
            ),
            type: v.optional(
              v.union([
                v.enumOf(['file', 'document', 'directory']),
                v.array(v.enumOf(['file', 'document', 'directory']))
              ]),
              {
                description:
                  'Filter by store item type. Repeat `type` to include multiple values. Defaults to `file` and `document`.'
              }
            ),
            created_at: dateFilterValidator('item creation time'),
            updated_at: dateFilterValidator('item last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await storeItemService.listStoreItems({
          storeId: ctx.store.id,
          types: normalizeArrayParam(ctx.query.type),
          ...(await getInstanceCargoAccess(ctx)),
          ids: normalizeArrayParam(ctx.query.id),
          fileIds: normalizeArrayParam(ctx.query.file_id),
          documentIds: normalizeArrayParam(ctx.query.document_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, storeItem => storeItemPresenter.present({ storeItem }));
      }),

    get: storeItemGroup
      .get(instancePath('stores/:storeId/items/:itemId', 'stores.items.get'), {
        name: 'Get store item',
        description: 'Retrieves an item in a store.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .output(storeItemPresenter)
      .do(async ctx => storeItemPresenter.present({ storeItem: ctx.storeItem }))
  }
);
