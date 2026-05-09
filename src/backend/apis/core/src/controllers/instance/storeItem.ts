import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeItemService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { storeItemPresenter } from '../../presenters';
import { storeGroup } from './store';

export let storeItemGroup = storeGroup.use(async ctx => {
  if (!ctx.params.itemId) {
    throw new Error('itemId is required');
  }

  let storeItem = await storeItemService.getStoreItemById({
    itemId: ctx.params.itemId,
    owner: {
      type: 'instance',
      instance: ctx.instance,
      organization: ctx.organization
    }
  });

  if (storeItem.storeId !== ctx.store.id) {
    throw new ServiceError(notFoundError('store.item', ctx.params.itemId));
  }

  return { storeItem };
});

export let storeItemController = Controller.create(
  {
    name: 'Store Items',
    description: 'Inspect items within an instance store.'
  },
  {
    list: storeGroup
      .get(instancePath('stores/:storeId/items', 'stores.items.list'), {
        name: 'List store items',
        description: 'Returns a paginated list of items for a specific store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .outputList(storeItemPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await storeItemService.listStoreItems({
          storeId: ctx.store.id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          }
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, storeItem => storeItemPresenter.present({ storeItem }));
      }),

    get: storeItemGroup
      .get(instancePath('stores/:storeId/items/:itemId', 'stores.items.get'), {
        name: 'Get store item by ID',
        description: 'Retrieves a specific item within a store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .output(storeItemPresenter)
      .do(async ctx => storeItemPresenter.present({ storeItem: ctx.storeItem }))
  }
);
