import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { authConfigErrorService } from '@metorial-subspace/module-auth';
import { authConfigErrorPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let authConfigErrorApp = tenantApp.use(async ctx => {
  let authConfigErrorId = ctx.body.authConfigErrorId;
  if (!authConfigErrorId) throw new Error('AuthConfigError ID is required');

  let authConfigError = await authConfigErrorService.getAuthConfigErrorById({
    authConfigErrorId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { authConfigError };
});

export let authConfigErrorController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          authConfigEventIds: v.optional(v.array(v.string())),
          authConfigIds: v.optional(v.array(v.string())),
          authCredentialsIds: v.optional(v.array(v.string())),
          providerOAuthSetupIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          authConfigErrorGlobalIds: v.optional(v.array(v.string())),
          providerInvocationIds: v.optional(v.array(v.string())),
          types: v.optional(v.array(v.string())),

          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await authConfigErrorService.listAuthConfigErrors({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        authConfigEventIds: ctx.input.authConfigEventIds,
        authConfigIds: ctx.input.authConfigIds,
        authCredentialsIds: ctx.input.authCredentialsIds,
        providerOAuthSetupIds: ctx.input.providerOAuthSetupIds,
        providerIds: ctx.input.providerIds,
        authConfigErrorGlobalIds: ctx.input.authConfigErrorGlobalIds,
        providerInvocationIds: ctx.input.providerInvocationIds,
        types: ctx.input.types,
        createdAt: ctx.input.createdAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, authConfigErrorPresenter);
    }),

  get: authConfigErrorApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        authConfigErrorId: v.string()
      })
    )
    .do(async ctx => authConfigErrorPresenter(ctx.authConfigError))
});
