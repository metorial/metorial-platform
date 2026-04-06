import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceProviderListingService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerListingPresenter } from '../../presenters';

let providerListingGroup = instanceGroup.use(async ctx => {
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

let orderByUseMapper = {
  deployments: 'deployments' as const,
  configs: 'configs' as const,
  auth_configs: 'authConfigs' as const,
  credentials: 'credentials' as const,
  sessions: 'sessions' as const,
  session_templates: 'sessionTemplates' as const,
  last_use_at: 'lastUseAt' as const,
  first_deployment_at: 'firstDeploymentAt' as const,
  first_config_at: 'firstConfigAt' as const,
  first_auth_config_at: 'firstAuthConfigAt' as const,
  first_credential_at: 'firstCredentialAt' as const,
  first_session_at: 'firstSessionAt' as const,
  first_session_template_at: 'firstSessionTemplateAt' as const,
  last_deployment_at: 'lastDeploymentAt' as const,
  last_config_at: 'lastConfigAt' as const,
  last_auth_config_at: 'lastAuthConfigAt' as const,
  last_credential_at: 'lastCredentialAt' as const,
  last_session_at: 'lastSessionAt' as const,
  last_session_template_at: 'lastSessionTemplateAt' as const
};

export let providerListingController = Controller.create(
  {
    name: 'Provider Listings',
    description: 'A listing is a provider enriched with marketplace metadata.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-listings', 'providerListings.list'), {
        name: 'List provider listings',
        description: 'Returns a paginated list of provider listings.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.listing:read'] }))
      .outputList(providerListingPresenter)
      .query(
        'mt_2026_01_01_magnetar',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),

            id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_category_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_collection_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            publisher_id: v.optional(v.union([v.string(), v.array(v.string())])),

            is_owner: v.optional(v.boolean()),
            is_public: v.optional(v.boolean()),
            is_verified: v.optional(v.boolean()),
            is_official: v.optional(v.boolean()),
            is_metorial: v.optional(v.boolean()),
            created_at: dateFilterValidator('provider listing creation time'),
            updated_at: dateFilterValidator('provider listing last update time')
          })
        ),
        v => ({
          ...v,
          only_from_tenant: v.is_owner
        })
      )
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_category_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_collection_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            publisher_id: v.optional(v.union([v.string(), v.array(v.string())])),

            capabilities: v.optional(
              v.object({
                supportsConfig: v.optional(v.boolean()),
                supportsAuth: v.optional(v.boolean()),
                supportsOAuth: v.optional(v.boolean()),
                supportsCallbacks: v.optional(v.boolean()),
                supportsOAuthAutoRegistration: v.optional(v.boolean()),
                supportsAuthExport: v.optional(v.boolean()),
                supportsAuthImport: v.optional(v.boolean())
              })
            ),

            is_public: v.optional(v.boolean()),
            only_from_tenant: v.optional(v.boolean()),
            is_verified: v.optional(v.boolean()),
            is_official: v.optional(v.boolean()),
            is_metorial: v.optional(v.boolean()),
            order_by_rank: v.optional(v.boolean()),

            order_by_use: v.optional(v.enumOf(Object.keys(orderByUseMapper) as any)),
            created_at: dateFilterValidator('provider listing creation time'),
            updated_at: dateFilterValidator('provider listing last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderListingService.list({
          instance: ctx.instance,
          search: ctx.query.search,

          ids: normalizeArrayParam(ctx.query.id),
          publisherIds: normalizeArrayParam(ctx.query.publisher_id),
          providerCategoryIds: normalizeArrayParam(ctx.query.provider_category_id),
          providerCollectionIds: normalizeArrayParam(ctx.query.provider_collection_id),
          providerGroupIds: normalizeArrayParam(ctx.query.provider_group_id),

          onlyFromTenant: ctx.query.only_from_tenant,

          isPublic: ctx.query.is_public,
          isVerified: ctx.query.is_verified,
          isOfficial: ctx.query.is_official,
          isMetorial: ctx.query.is_metorial,
          orderByRank: ctx.query.order_by_rank !== false,
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at,

          capabilities: ctx.query.capabilities,

          orderByUse: ctx.query.order_by_use
            ? orderByUseMapper[ctx.query.order_by_use as keyof typeof orderByUseMapper]
            : undefined
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerListing =>
          providerListingPresenter.present({
            providerListing
          })
        );
      }),

    get: providerListingGroup
      .get(instancePath('provider-listings/:providerListingId', 'providerListings.get'), {
        name: 'Get provider listing',
        description: 'Retrieves a specific provider listing by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.listing:read'] }))
      .output(providerListingPresenter)
      .do(async ctx => {
        return providerListingPresenter.present({ providerListing: ctx.providerListing });
      })
  }
);
