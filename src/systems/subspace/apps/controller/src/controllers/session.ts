import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionService } from '@metorial-subspace/module-session';
import { sessionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import {
  authConfigValidator,
  configValidator,
  deploymentValidator,
  resolveSessionProvider
} from './providerResourceValidators';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let sessionApp = tenantApp.use(async ctx => {
  let sessionId = ctx.body.sessionId;
  if (!sessionId) throw new Error('Session ID is required');

  let session = await sessionService.getSessionById({
    sessionId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { session };
});

export let sessionController = app.controller({
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
          sessionTemplateIds: v.optional(v.array(v.string())),
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
      let paginator = await sessionService.listSessions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        sessionTemplateIds: ctx.input.sessionTemplateIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionPresenter);
    }),

  get: sessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionPresenter(ctx.session)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        providers: v.array(
          v.object({
            providerDeployment: v.optional(deploymentValidator),
            providerConfig: v.optional(configValidator),
            providerAuthConfig: v.optional(authConfigValidator),
            sessionTemplateId: v.optional(v.string()),
            toolFilters: toolFiltersValidator
          })
        ),

        ua: v.optional(v.string()),
        ip: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let resolvedProviders = await Promise.all(
        ctx.input.providers.map(async p => {
          let resolved = await resolveSessionProvider(
            { tenant: ctx.tenant, solution: ctx.solution, environment: ctx.environment },
            p,
            { ua: ctx.input.ua, ip: ctx.input.ip }
          );

          return {
            ...resolved,
            sessionTemplateId: p.sessionTemplateId,
            toolFilters: normalizeToolFilters(p.toolFilters),
            __allowEphemeral: resolved.hasEphemeral
          };
        })
      );

      let session = await sessionService.createSession({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          providers: resolvedProviders
        }
      });

      return sessionPresenter(session);
    }),

  update: sessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string(),

        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let session = await sessionService.updateSession({
        session: ctx.session,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return sessionPresenter(session);
    }),

  delete: sessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let session = await sessionService.archiveSession({
        session: ctx.session,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return sessionPresenter(session);
    })
});
