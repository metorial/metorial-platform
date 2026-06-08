import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerApp = tenantApp.use(async ctx => {
  let providerId = ctx.body.providerId;
  if (!providerId) throw new Error('Provider ID is required');

  let provider = await providerService.getProviderById({
    providerId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { provider };
});

export let providerController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          includeDeprecated: v.optional(v.boolean()),

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
          )
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerService.listProviders({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        includeDeprecated: ctx.input.includeDeprecated,
        capabilities: ctx.input.capabilities
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, v => providerPresenter(v, ctx));
    }),

  get: providerApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerId: v.string()
      })
    )
    .do(async ctx => await providerPresenter(ctx.provider, ctx)),

  update: providerApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        readme: v.optional(v.string()),
        slug: v.optional(v.string()),
        aliases: v.optional(v.array(v.string())),
        image: v.optional(v.any()),
        skills: v.optional(v.array(v.string())),
        access: v.optional(v.enumOf(['public', 'tenant'])),
        status: v.optional(v.enumOf(['active', 'archived', 'deleted'])),
        isDeprecated: v.optional(v.boolean()),
        isPublic: v.optional(v.boolean()),
        isMetorial: v.optional(v.boolean()),
        isVerified: v.optional(v.boolean()),
        isOfficial: v.optional(v.boolean()),
        rank: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let provider = await providerService.updateProvider({
        provider: ctx.provider,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          readme: ctx.input.readme,
          slug: ctx.input.slug,
          aliases: ctx.input.aliases,
          image: ctx.input.image,
          skills: ctx.input.skills,
          access: ctx.input.access,
          status: ctx.input.status,
          isDeprecated: ctx.input.isDeprecated,
          isPublic: ctx.input.isPublic,
          isMetorial: ctx.input.isMetorial,
          isVerified: ctx.input.isVerified,
          isOfficial: ctx.input.isOfficial,
          rank: ctx.input.rank
        }
      });

      return await providerPresenter(provider, ctx);
    })
});
