import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import {
  type ProviderListingOrderByUse,
  providerListingService
} from '@metorial-subspace/module-catalog';
import { providerListingPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantOptionalApp } from './tenant';

export let providerListingApp = tenantOptionalApp.use(async ctx => {
  let providerListingId = ctx.body.providerListingId;
  if (!providerListingId) throw new Error('ProviderListing ID is required');

  let providerListing = await providerListingService.getProviderListingById({
    providerListingId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerListing };
});

export let providerListingController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),

          search: v.optional(v.string()),

          providerCollectionIds: v.optional(v.array(v.string())),
          providerCategoryIds: v.optional(v.array(v.string())),
          providerGroupIds: v.optional(v.array(v.string())),
          publisherIds: v.optional(v.array(v.string())),
          ids: v.optional(v.array(v.string())),
          includeDeprecated: v.optional(v.boolean()),

          isPublic: v.optional(v.boolean()),
          onlyFromTenant: v.optional(v.boolean()),

          isVerified: v.optional(v.boolean()),
          isOfficial: v.optional(v.boolean()),
          isMetorial: v.optional(v.boolean()),

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

          orderByRank: v.optional(v.boolean()),
          orderByUse: v.optional(
            v.enumOf([
              'deployments',
              'configs',
              'authConfigs',
              'credentials',
              'sessions',
              'sessionTemplates',
              'lastUseAt',
              'firstDeploymentAt',
              'firstConfigAt',
              'firstAuthConfigAt',
              'firstCredentialAt',
              'firstSessionAt',
              'firstSessionTemplateAt',
              'lastDeploymentAt',
              'lastConfigAt',
              'lastAuthConfigAt',
              'lastCredentialAt',
              'lastSessionAt',
              'lastSessionTemplateAt'
            ])
          ),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerListingService.listProviderListings({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        providerCollectionIds: ctx.input.providerCollectionIds,
        providerCategoryIds: ctx.input.providerCategoryIds,
        providerGroupIds: ctx.input.providerGroupIds,
        publisherIds: ctx.input.publisherIds,
        ids: ctx.input.ids,
        includeDeprecated: ctx.input.includeDeprecated,

        capabilities: ctx.input.capabilities,

        isPublic: ctx.input.isPublic,
        onlyFromTenant: ctx.input.onlyFromTenant,

        isVerified: ctx.input.isVerified,
        isOfficial: ctx.input.isOfficial,
        isMetorial: ctx.input.isMetorial,

        orderByRank: ctx.input.orderByRank,
        orderByUse: ctx.input.orderByUse as ProviderListingOrderByUse | undefined,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, v => providerListingPresenter(v, ctx));
    }),

  get: providerListingApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),
        providerListingId: v.string()
      })
    )
    .do(async ctx => await providerListingPresenter(ctx.providerListing, ctx))
});
