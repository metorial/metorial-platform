import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { authConfigEventService } from '@metorial-subspace/module-auth';
import { authConfigEventPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let authConfigEventApp = tenantApp.use(async ctx => {
  let authConfigEventId = ctx.body.authConfigEventId;
  if (!authConfigEventId) throw new Error('AuthConfigEvent ID is required');

  let authConfigEvent = await authConfigEventService.getAuthConfigEventById({
    authConfigEventId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { authConfigEvent };
});

export let authConfigEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          authConfigIds: v.optional(v.array(v.string())),
          authCredentialsIds: v.optional(v.array(v.string())),
          providerOAuthSetupIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerInvocationIds: v.optional(v.array(v.string())),
          types: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await authConfigEventService.listAuthConfigEvents({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        authConfigIds: ctx.input.authConfigIds,
        authCredentialsIds: ctx.input.authCredentialsIds,
        providerOAuthSetupIds: ctx.input.providerOAuthSetupIds,
        providerIds: ctx.input.providerIds,
        providerInvocationIds: ctx.input.providerInvocationIds,
        types: ctx.input.types,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, authConfigEventPresenter);
    }),

  get: authConfigEventApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        authConfigEventId: v.string()
      })
    )
    .do(async ctx => authConfigEventPresenter(ctx.authConfigEvent))
});
