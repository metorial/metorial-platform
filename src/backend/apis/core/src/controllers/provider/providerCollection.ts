import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingCollectionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerInstanceGroup, providerPath } from '../../middleware/providerGroup';
import { providerCollectionPresenter } from '../../presenters';
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
    description:
      "A collection is a curated set of providers like 'Featured', 'Most Popular', or 'New Arrivals'."
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-collections', 'providerCollections.list'), {
        name: 'List provider collections',
        description: 'Returns a paginated list of provider collections.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerCollectionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspaceProviderListingCollectionService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, collection =>
          providerCollectionPresenter.present({ collection: collection as SubspaceCollection })
        );
      }),

    get: providerCollectionGroup
      .get(
        providerPath('provider-collections/:providerCollectionId', 'providerCollections.get'),
        {
          name: 'Get provider collection',
          description: 'Retrieves a specific provider collection by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerCollectionPresenter)
      .do(async ctx => {
        return providerCollectionPresenter.present({ collection: ctx.collection });
      })
  }
);
