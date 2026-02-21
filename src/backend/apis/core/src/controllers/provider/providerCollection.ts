import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingCollectionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
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
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by collection ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_listing_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider listing ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderListingCollectionService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerListingIds: normalizeArrayParam(ctx.query.provider_listing_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, collection =>
          providerCollectionPresenter.present({
            collection
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
