import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderListingService,
  type SubspaceProviderListing
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerListingPresenter } from '../../presenters';

export let providerListingGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerListingId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerListingId is required',
        description: 'The providerListingId path parameter is required.'
      })
    );
  }

  let providerListing = await subspaceProviderListingService.get({
    instance: ctx.instance,
    providerListingId: ctx.params.providerListingId
  });

  return { providerListing };
});

export let providerListingController = Controller.create(
  {
    name: 'Provider Listings',
    description: 'A listing is a provider enriched with marketplace metadata.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-listings', 'providerListings.list'), {
        name: 'List provider listings',
        description: 'Returns a paginated list of provider listings.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerListingPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_version_id: v.optional(v.string()),
            provider_category_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_collection_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            publisher_id: v.optional(v.union([v.string(), v.array(v.string())])),

            is_public: v.optional(v.boolean()),
            is_verified: v.optional(v.boolean()),
            is_official: v.optional(v.boolean()),
            is_metorial: v.optional(v.boolean())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderListingService.list({
          instance: ctx.instance,
          search: ctx.query.search,
          publisherIds: normalizeArrayParam(ctx.query.publisher_id),
          providerCategoryIds: normalizeArrayParam(ctx.query.provider_category_id),
          providerCollectionIds: normalizeArrayParam(ctx.query.provider_collection_id),
          providerGroupIds: normalizeArrayParam(ctx.query.provider_group_id),

          isPublic: ctx.query.is_public,
          isVerified: ctx.query.is_verified,
          isOfficial: ctx.query.is_official,
          isMetorial: ctx.query.is_metorial
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerListing =>
          providerListingPresenter.present({
            providerListing: providerListing as SubspaceProviderListing
          })
        );
      }),

    get: providerListingGroup
      .get(instancePath('provider-listings/:providerListingId', 'providerListings.get'), {
        name: 'Get provider listing',
        description: 'Retrieves a specific provider listing by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerListingPresenter)
      .do(async ctx => {
        return providerListingPresenter.present({ providerListing: ctx.providerListing });
      })
  }
);
