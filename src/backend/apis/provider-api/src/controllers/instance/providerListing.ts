import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { providerListingPresenter } from '../../presenters';
import { SubspaceProviderListing } from '../../presenters/types';

export let providerListingGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerId is required',
        description: 'The providerId path parameter is required.'
      })
    );
  }

  let providerListing = await subspaceProviderListingService.get({
    instance: ctx.instance,
    providerId: ctx.params.providerId
  });

  return { providerListing };
});

export let providerListingController = Controller.create(
  {
    name: 'Provider Listings',
    description: 'Browse provider listings in the catalog.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-listings', 'providerListings.list'), {
        name: 'List provider listings',
        description: 'Returns a paginated list of provider listings.'
      })
      .outputList(providerListingPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            provider_category_id: v.optional(v.string()),
            provider_collection_id: v.optional(v.string()),
            provider_group_id: v.optional(v.string()),
            publisher_id: v.optional(v.string()),
            is_public: v.optional(v.string()),
            is_verified: v.optional(v.string()),
            is_official: v.optional(v.string()),
            is_metorial: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderListingService.list({
          instance: ctx.instance,
          search: ctx.query.search,
          providerCategoryId: ctx.query.provider_category_id,
          providerCollectionId: ctx.query.provider_collection_id,
          providerGroupId: ctx.query.provider_group_id,
          publisherId: ctx.query.publisher_id,
          isPublic: ctx.query.is_public === 'true' ? true : ctx.query.is_public === 'false' ? false : undefined,
          isVerified: ctx.query.is_verified === 'true' ? true : ctx.query.is_verified === 'false' ? false : undefined,
          isOfficial: ctx.query.is_official === 'true' ? true : ctx.query.is_official === 'false' ? false : undefined,
          isMetorial: ctx.query.is_metorial === 'true' ? true : ctx.query.is_metorial === 'false' ? false : undefined
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerListing =>
          providerListingPresenter.present({ providerListing: providerListing as SubspaceProviderListing })
        );
      }),

    get: providerListingGroup
      .get(providerPath('provider-listings/:providerId', 'providerListings.get'), {
        name: 'Get provider listing',
        description: 'Retrieves a specific provider listing by ID.'
      })
      .output(providerListingPresenter)
      .do(async ctx => {
        return providerListingPresenter.present({ providerListing: ctx.providerListing });
      })
  }
);
