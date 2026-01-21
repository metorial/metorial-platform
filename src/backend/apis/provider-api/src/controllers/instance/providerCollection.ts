import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingCollectionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { collectionPresenter } from '../../presenters';
import { SubspaceCollection } from '../../presenters/types';

export let providerCollectionGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerCollectionId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerCollectionId is required',
        description: 'The providerCollectionId path parameter is required.'
      })
    );
  }

  let collection = await subspaceProviderListingCollectionService.get({
    instance: ctx.instance,
    providerListingCollectionId: ctx.params.providerCollectionId
  });

  return { collection };
});

export let providerCollectionController = Controller.create(
  {
    name: 'Provider Collections',
    description: 'Browse provider collections in the catalog.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-collections', 'providerCollections.list'), {
        name: 'List provider collections',
        description: 'Returns a paginated list of provider collections.'
      })
      .outputList(collectionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspaceProviderListingCollectionService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, collection =>
          collectionPresenter.present({ collection: collection as SubspaceCollection })
        );
      }),

    get: providerCollectionGroup
      .get(providerPath('provider-collections/:providerCollectionId', 'providerCollections.get'), {
        name: 'Get provider collection',
        description: 'Retrieves a specific provider collection by ID.'
      })
      .output(collectionPresenter)
      .do(async ctx => {
        return collectionPresenter.present({ collection: ctx.collection });
      })
  }
);
