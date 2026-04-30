import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  delegatedIntegrationInstanceProviderService,
  delegatedIntegrationInstanceService
} from '@metorial-subspace/module-integration';
import { delegatedIntegrationInstanceProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let delegatedIntegrationInstanceProviderApp = tenantApp.use(async ctx => {
  let delegatedIntegrationInstanceProviderId = ctx.body.delegatedIntegrationInstanceProviderId;
  if (!delegatedIntegrationInstanceProviderId) {
    throw new Error('DelegatedIntegrationInstanceProvider ID is required');
  }

  let delegatedIntegrationInstanceProvider =
    await delegatedIntegrationInstanceProviderService.getDelegatedIntegrationInstanceProviderById(
      {
        delegatedIntegrationInstanceProviderId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        allowDeleted: ctx.body.allowDeleted
      }
    );

  return { delegatedIntegrationInstanceProvider };
});

export let delegatedIntegrationInstanceProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),

          ids: v.optional(v.array(v.string())),
          delegatedIntegrationInstanceIds: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          integrationInstanceIds: v.optional(v.array(v.string())),
          integrationInstanceProviderIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator =
        await delegatedIntegrationInstanceProviderService.listDelegatedIntegrationInstanceProviders(
          {
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,

            allowDeleted: ctx.input.allowDeleted,
            status: ctx.input.status,

            ids: ctx.input.ids,
            delegatedIntegrationInstanceIds: ctx.input.delegatedIntegrationInstanceIds,
            integrationIds: ctx.input.integrationIds,
            integrationInstanceIds: ctx.input.integrationInstanceIds,
            integrationInstanceProviderIds: ctx.input.integrationInstanceProviderIds,
            providerIds: ctx.input.providerIds,
            integrationProviderIds: ctx.input.integrationProviderIds,
            providerDeploymentIds: ctx.input.providerDeploymentIds,
            providerConfigIds: ctx.input.providerConfigIds,
            providerAuthConfigIds: ctx.input.providerAuthConfigIds,
            sessionTemplateIds: ctx.input.sessionTemplateIds,

            createdAt: ctx.input.createdAt,
            updatedAt: ctx.input.updatedAt
          }
        );

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, delegatedIntegrationInstanceProviderPresenter);
    }),

  get: delegatedIntegrationInstanceProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        delegatedIntegrationInstanceProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      delegatedIntegrationInstanceProviderPresenter(ctx.delegatedIntegrationInstanceProvider)
    ),

  set: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        delegatedIntegrationInstanceId: v.string(),
        integrationInstanceProviderId: v.string(),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let delegatedIntegrationInstance =
        await delegatedIntegrationInstanceService.getDelegatedIntegrationInstanceById({
          delegatedIntegrationInstanceId: ctx.input.delegatedIntegrationInstanceId,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      let delegatedIntegrationInstanceProvider =
        await delegatedIntegrationInstanceProviderService.setDelegatedIntegrationInstanceProvider(
          {
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            delegatedIntegrationInstance,
            input: {
              integrationInstanceProviderId: ctx.input.integrationInstanceProviderId,
              ...(ctx.input.toolFilters !== undefined
                ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
                : {})
            }
          }
        );

      return delegatedIntegrationInstanceProviderPresenter(
        delegatedIntegrationInstanceProvider
      );
    }),

  delete: delegatedIntegrationInstanceProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        delegatedIntegrationInstanceProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let delegatedIntegrationInstanceProvider =
        await delegatedIntegrationInstanceProviderService.archiveDelegatedIntegrationInstanceProvider(
          {
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            delegatedIntegrationInstanceProvider: ctx.delegatedIntegrationInstanceProvider
          }
        );

      return delegatedIntegrationInstanceProviderPresenter(
        delegatedIntegrationInstanceProvider
      );
    })
});
