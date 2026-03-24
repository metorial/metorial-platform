import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerAuthMethodService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import { providerAuthMethodPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp, tenantOptionalApp } from './tenant';

export let providerAuthMethodApp = tenantApp.use(async ctx => {
  let providerAuthMethodId = ctx.body.providerAuthMethodId;
  if (!providerAuthMethodId) throw new Error('ProviderAuthMethod ID is required');

  let providerAuthMethod = await providerAuthMethodService.getProviderAuthMethodById({
    providerAuthMethodId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerAuthMethod };
});

export let providerAuthMethodController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),

          providerVersionId: v.string()
        })
      )
    )
    .do(async ctx => {
      let providerVersion = await providerVersionService.getProviderVersionById({
        providerVersionId: ctx.input.providerVersionId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let paginator = await providerAuthMethodService.listProviderAuthMethods({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        providerVersion
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthMethodPresenter);
    }),

  get: providerAuthMethodApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthMethodId: v.string()
      })
    )
    .do(async ctx => providerAuthMethodPresenter(ctx.providerAuthMethod))
});
