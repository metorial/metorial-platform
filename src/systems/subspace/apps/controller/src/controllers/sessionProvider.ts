import { Paginator } from '@lowerdeck/pagination';
import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { normalizeToolFilters as normalizeProviderToolFilters } from '@metorial-subspace/module-provider-internal';
import {
  sessionProviderNameTemplateService,
  sessionProviderService,
  sessionService
} from '@metorial-subspace/module-session';
import { sessionProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import {
  authConfigValidator,
  configValidator,
  deploymentValidator,
  resolveSessionProvider
} from './providerResourceValidators';
import { tenantApp } from './tenant';

export let sessionProviderApp = tenantApp.use(async ctx => {
  let sessionProviderId = ctx.body.sessionProviderId;
  if (!sessionProviderId) throw new Error('SessionProvider ID is required');

  let sessionProvider = await sessionProviderService.getSessionProviderById({
    sessionProviderId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { sessionProvider };
});

export let toolFilterValidator = v.union([
  v.object({
    type: v.literal('tool_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('tool_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_uris'),
    uris: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_regex'),
    pattern: v.string()
  })
]);

export let toolFiltersValidator = v.nullable(
  v.optional(
    v.union([
      toolFilterValidator,
      v.array(toolFilterValidator),
      v.object({
        type: v.literal('v1.allow_all'),
        ignoreParentFilters: v.optional(v.boolean())
      }),
      v.object({
        type: v.literal('v1.filter'),
        ignoreParentFilters: v.optional(v.boolean()),
        filters: v.array(toolFilterValidator)
      }),
      v.object({
        ignoreParentFilters: v.optional(v.boolean()),
        filters: v.optional(
          v.nullable(v.union([toolFilterValidator, v.array(toolFilterValidator)]))
        )
      })
    ])
  )
);

export let normalizeToolFilters = (
  t: ValidationTypeValue<typeof toolFiltersValidator>
): PrismaJson.ToolFilter => normalizeProviderToolFilters(t as any);

export let sessionProviderController = app.controller({
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
          sessionIds: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),
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
      let paginator = await sessionProviderService.listSessionProviders({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        sessionTemplateIds: ctx.input.sessionTemplateIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,

        allowDeleted: ctx.input.allowDeleted,
        status: ctx.input.status,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);
      list.items = await sessionProviderNameTemplateService.ensureForSessionProviders({
        tenant: ctx.tenant,
        providers: list.items
      });

      return Paginator.presentLight(list, sessionProviderPresenter);
    }),

  get: sessionProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionProviderPresenter(ctx.sessionProvider)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        sessionId: v.string(),

        providerDeployment: v.optional(deploymentValidator),
        providerConfig: v.optional(configValidator),
        providerAuthConfig: v.optional(authConfigValidator),

        toolFilters: toolFiltersValidator,

        ua: v.optional(v.string()),
        ip: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let session = await sessionService.getSessionById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        sessionId: ctx.input.sessionId
      });

      let resolved = await resolveSessionProvider(
        { tenant: ctx.tenant, solution: ctx.solution, environment: ctx.environment },
        ctx.input,
        { ua: ctx.input.ua, ip: ctx.input.ip }
      );

      let sessionProvider = await sessionProviderService.createSessionProvider({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        session,

        input: {
          ...resolved,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters)
        }
      });

      return sessionProviderPresenter(sessionProvider);
    }),

  update: sessionProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let sessionProvider = await sessionProviderService.updateSessionProvider({
        sessionProvider: ctx.sessionProvider,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          toolFilters: normalizeToolFilters(ctx.input.toolFilters)
        }
      });

      return sessionProviderPresenter(sessionProvider);
    }),

  delete: sessionProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let sessionProvider = await sessionProviderService.archiveSessionProvider({
        sessionProvider: ctx.sessionProvider,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return sessionProviderPresenter(sessionProvider);
    })
});
