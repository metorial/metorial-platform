import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionTemplateService } from '@metorial-subspace/module-session';
import { sessionTemplatePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let sessionTemplateApp = tenantApp.use(async ctx => {
  let sessionTemplateId = ctx.body.sessionTemplateId;
  if (!sessionTemplateId) throw new Error('SessionTemplate ID is required');

  let sessionTemplate = await sessionTemplateService.getSessionTemplateById({
    sessionTemplateId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { sessionTemplate };
});

export let sessionTemplateController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionTemplateService.listSessionTemplates({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionTemplatePresenter);
    }),

  get: sessionTemplateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionTemplateId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionTemplatePresenter(ctx.sessionTemplate)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        isInternal: v.optional(v.boolean()),

        providers: v.array(
          v.object({
            providerDeploymentId: v.optional(v.string()),
            providerConfigId: v.optional(v.string()),
            providerAuthConfigId: v.optional(v.string()),
            toolFilters: toolFiltersValidator
          })
        )
      })
    )
    .do(async ctx => {
      let sessionTemplate = await sessionTemplateService.createSessionTemplate({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          isInternal: !!ctx.input.isInternal,

          providers: ctx.input.providers.map(p => ({
            deploymentId: p.providerDeploymentId,
            configId: p.providerConfigId,
            authConfigId: p.providerAuthConfigId,
            toolFilters: p.toolFilters as any
          }))
        }
      });

      return sessionTemplatePresenter(sessionTemplate);
    }),

  update: sessionTemplateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionTemplateId: v.string(),

        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let sessionTemplate = await sessionTemplateService.updateSessionTemplate({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        template: ctx.sessionTemplate,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return sessionTemplatePresenter(sessionTemplate);
    })
});
