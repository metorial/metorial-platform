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
          environmentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerService.listProviders({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
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
    .do(async ctx => providerPresenter(ctx.provider, ctx)),

  update: providerApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        slug: v.optional(v.string()),
        image: v.optional(v.any()),
        skills: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let provider = await providerService.updateProvider({
        provider: ctx.provider,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          slug: ctx.input.slug,
          image: ctx.input.image,
          skills: ctx.input.skills
        }
      });

      return providerPresenter(provider, ctx);
    })
});
