import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { authConfigErrorGlobalService } from '@metorial-subspace/module-auth';
import { authConfigErrorGlobalPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let authConfigErrorGlobalApp = tenantApp.use(async ctx => {
  let authConfigErrorGlobalId = ctx.body.authConfigErrorGlobalId;
  if (!authConfigErrorGlobalId) throw new Error('AuthConfigErrorGlobal ID is required');

  let authConfigErrorGlobal = await authConfigErrorGlobalService.getAuthConfigErrorGlobalById({
    authConfigErrorGlobalId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { authConfigErrorGlobal };
});

export let authConfigErrorGlobalController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          authConfigIds: v.optional(v.array(v.string())),
          authCredentialsIds: v.optional(v.array(v.string())),
          types: v.optional(v.array(v.string())),

          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await authConfigErrorGlobalService.listAuthConfigErrorGlobals({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        authConfigIds: ctx.input.authConfigIds,
        authCredentialsIds: ctx.input.authCredentialsIds,
        types: ctx.input.types,
        createdAt: ctx.input.createdAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, authConfigErrorGlobalPresenter);
    }),

  get: authConfigErrorGlobalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        authConfigErrorGlobalId: v.string()
      })
    )
    .do(async ctx => authConfigErrorGlobalPresenter(ctx.authConfigErrorGlobal))
});
