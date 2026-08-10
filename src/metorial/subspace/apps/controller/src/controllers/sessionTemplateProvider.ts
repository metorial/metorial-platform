import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  sessionTemplateProviderService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { sessionTemplateProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let sessionTemplateProviderApp = tenantApp.use(async ctx => {
  let sessionTemplateProviderId = ctx.body.sessionTemplateProviderId;
  if (!sessionTemplateProviderId) throw new Error('SessionTemplateProvider ID is required');

  let sessionTemplateProvider =
    await sessionTemplateProviderService.getSessionTemplateProviderById({
      sessionTemplateProviderId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { sessionTemplateProvider };
});

export let sessionTemplateProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['active', 'archived']))),

          ids: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          integrationInstanceIds: v.optional(v.array(v.string())),
          integrationInstanceGroupIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),
          integrationInstanceProviderIds: v.optional(v.array(v.string())),
          integrationInstanceGroupProviderIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionTemplateProviderService.listSessionTemplateProviders({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        sessionTemplateIds: ctx.input.sessionTemplateIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        integrationIds: ctx.input.integrationIds,
        integrationInstanceIds: ctx.input.integrationInstanceIds,
        integrationInstanceGroupIds: ctx.input.integrationInstanceGroupIds,
        integrationProviderIds: ctx.input.integrationProviderIds,
        integrationInstanceProviderIds: ctx.input.integrationInstanceProviderIds,
        integrationInstanceGroupProviderIds: ctx.input.integrationInstanceGroupProviderIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionTemplateProviderPresenter);
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionTemplateIds: v.array(v.string()),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let sessionTemplateProviders =
        await sessionTemplateProviderService.getManySessionTemplateProvidersBySessionTemplateIds(
          {
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            sessionTemplateIds: ctx.input.sessionTemplateIds,
            allowDeleted: ctx.input.allowDeleted
          }
        );

      return sessionTemplateProviders.map(sessionTemplateProviderPresenter);
    }),

  get: sessionTemplateProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionTemplateProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionTemplateProviderPresenter(ctx.sessionTemplateProvider)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        sessionTemplateId: v.string(),

        providerDeploymentId: v.optional(v.string()),
        providerConfigId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),

        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let sessionTemplate = await sessionTemplateService.getSessionTemplateById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        sessionTemplateId: ctx.input.sessionTemplateId
      });

      let sessionTemplateProvider =
        await sessionTemplateProviderService.createSessionTemplateProvider({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          template: sessionTemplate,

          input: {
            deploymentId: ctx.input.providerDeploymentId,
            configId: ctx.input.providerConfigId,
            authConfigId: ctx.input.providerAuthConfigId,

            toolFilters: normalizeToolFilters(ctx.input.toolFilters)
          }
        });

      return sessionTemplateProviderPresenter(sessionTemplateProvider);
    }),

  update: sessionTemplateProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionTemplateProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let sessionTemplateProvider =
        await sessionTemplateProviderService.updateSessionTemplateProvider({
          sessionTemplateProvider: ctx.sessionTemplateProvider,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,

          input: {
            ...(ctx.input.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
              : {})
          }
        });

      return sessionTemplateProviderPresenter(sessionTemplateProvider);
    }),

  delete: sessionTemplateProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionTemplateProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let sessionTemplateProvider =
        await sessionTemplateProviderService.archiveSessionTemplateProvider({
          sessionTemplateProvider: ctx.sessionTemplateProvider,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      return sessionTemplateProviderPresenter(sessionTemplateProvider);
    })
});
