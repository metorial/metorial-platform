import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { customProviderService } from '@metorial-subspace/module-custom-provider';
import { actorService } from '@metorial-subspace/module-tenant';
import { customProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let customProviderApp = tenantApp.use(async ctx => {
  let customProviderId = ctx.body.customProviderId;
  if (!customProviderId) throw new Error('CustomProvider ID is required');

  let customProvider = await customProviderService.getCustomProviderById({
    customProviderId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { customProvider };
});

let functionRuntimeValidator = v.union([
  v.object({
    identifier: v.literal('nodejs'),
    version: v.enumOf(['24.x', '22.x'])
  }),
  v.object({
    identifier: v.literal('python'),
    version: v.enumOf(['3.14', '3.13', '3.12'])
  })
]);

let functionRepositoryValidator = v.optional(
  v.union([
    v.object({
      repositoryId: v.string(),
      branch: v.string(),
      path: v.optional(v.string())
    }),
    v.object({
      type: v.literal('git'),
      repositoryUrl: v.string(),
      branch: v.string(),
      path: v.optional(v.string())
    })
  ])
);

export let customProviderFromValidator = v.union([
  v.object({
    type: v.literal('container'),
    repository: v.object({
      imageRef: v.string(),
      username: v.optional(v.string()),
      password: v.optional(v.string())
    })
  }),
  v.object({
    type: v.literal('remote'),
    remoteUrl: v.string(),
    oauthConfig: v.optional(v.record(v.any())),
    protocol: v.enumOf(['sse', 'streamable_http'])
  }),
  v.object({
    type: v.literal('function'),
    files: v.array(
      v.object({
        filename: v.string(),
        content: v.string(),
        encoding: v.optional(v.enumOf(['utf-8', 'base64']))
      })
    ),
    env: v.record(v.string()),
    runtime: functionRuntimeValidator,
    repository: functionRepositoryValidator
  })
]);

export let customProviderFromUpdateValidator = v.union([
  v.object({
    type: v.literal('container'),
    repository: v.optional(
      v.object({
        imageRef: v.optional(v.string()),
        username: v.optional(v.string()),
        password: v.optional(v.string())
      })
    )
  }),
  v.object({
    type: v.literal('remote'),
    remoteUrl: v.optional(v.string()),
    oauthConfig: v.optional(v.record(v.any())),
    protocol: v.optional(v.enumOf(['sse', 'streamable_http']))
  }),
  v.object({
    type: v.literal('function'),
    files: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          content: v.string(),
          encoding: v.optional(v.enumOf(['utf-8', 'base64']))
        })
      )
    ),
    env: v.optional(v.record(v.string())),
    runtime: v.optional(functionRuntimeValidator),
    repository: functionRepositoryValidator
  })
]);

export let customProviderConfigValidator = v.optional(
  v.object({
    schema: v.record(v.any()),
    transformer: v.string()
  })
);

export let customProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          type: v.optional(v.array(v.enumOf(['container', 'function', 'remote']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator,

          includeEnv: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await customProviderService.listCustomProviders({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        type: ctx.input.type,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, v =>
        customProviderPresenter(v, {
          tenant: ctx.tenant,
          includeEnv: ctx.input.includeEnv
        })
      );
    }),

  get: customProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        customProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        includeEnv: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      customProviderPresenter(ctx.customProvider, {
        tenant: ctx.tenant,
        includeEnv: ctx.input.includeEnv
      })
    ),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        from: customProviderFromValidator,
        config: customProviderConfigValidator
      })
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      let customProvider = await customProviderService.createCustomProvider({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        actor,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          from: ctx.input.from as any,
          config: ctx.input.config as any
        }
      });

      return await customProviderPresenter(customProvider, { tenant: ctx.tenant });
    }),

  update: customProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.string(),

        customProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        readme: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        access: v.optional(v.enumOf(['public', 'tenant']))
      })
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      let customProvider = await customProviderService.updateCustomProvider({
        customProvider: ctx.customProvider,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        actor,

        input: {
          name: ctx.input.name,
          readme: ctx.input.readme,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          access: ctx.input.access
        }
      });

      return await customProviderPresenter(customProvider, { tenant: ctx.tenant });
    })
});
