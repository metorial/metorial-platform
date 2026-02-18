import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerListingPresenter } from '../../presenters';
import { SubspaceProviderListing } from '../../presenters/types';

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
            flags: v.optional(
              v.object({
                is_public: v.optional(v.string()),
                is_verified: v.optional(v.string()),
                is_official: v.optional(v.string()),
                is_metorial: v.optional(v.string())
              })
            )
          })
        )
      )
      .do(async ctx => {
        let flags = ctx.query.flags;
        let paginator = await subspaceProviderListingService.list({
          instance: ctx.instance,
          search: ctx.query.search,
          providerCategoryIds: normalizeArrayParam(ctx.query.provider_category_id),
          providerCollectionIds: normalizeArrayParam(ctx.query.provider_collection_id),
          providerGroupIds: normalizeArrayParam(ctx.query.provider_group_id),
          isPublic:
            flags?.is_public === 'true'
              ? true
              : flags?.is_public === 'false'
                ? false
                : undefined,
          isVerified:
            flags?.is_verified === 'true'
              ? true
              : flags?.is_verified === 'false'
                ? false
                : undefined,
          isOfficial:
            flags?.is_official === 'true'
              ? true
              : flags?.is_official === 'false'
                ? false
                : undefined,
          isMetorial:
            flags?.is_metorial === 'true'
              ? true
              : flags?.is_metorial === 'false'
                ? false
                : undefined
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
