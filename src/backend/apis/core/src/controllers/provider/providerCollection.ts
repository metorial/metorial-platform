import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderListingCollectionService,
  type SubspaceProviderListingCollection
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerCollectionPresenter } from '../../presenters';

export let providerCollectionGroup = instanceGroup.use(async ctx => {
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
    description:
      "A collection is a curated set of providers like 'Featured', 'Most Popular', or 'New Arrivals'."
  },
  {
    list: instanceGroup
      .get(instancePath('provider-collections', 'providerCollections.list'), {
        name: 'List provider collections',
        description: 'Returns a paginated list of provider collections.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerCollectionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            //       ids: string[] | undefined;
            // providerIds: string[] | undefined;
            // providerListingIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderListingCollectionService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, collection =>
          providerCollectionPresenter.present({
            collection: collection as SubspaceProviderListingCollection
          })
        );
      }),

    get: providerCollectionGroup
      .get(
        instancePath('provider-collections/:providerCollectionId', 'providerCollections.get'),
        {
          name: 'Get provider collection',
          description: 'Retrieves a specific provider collection by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerCollectionPresenter)
      .do(async ctx => {
        return providerCollectionPresenter.present({ collection: ctx.collection });
      })
  }
);
