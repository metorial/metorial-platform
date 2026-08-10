import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerTriggerService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import { providerTriggerPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantOptionalApp } from './tenant';

export let providerTriggerApp = tenantOptionalApp.use(async ctx => {
  let providerTriggerId = ctx.body.providerTriggerId;
  if (!providerTriggerId) throw new Error('ProviderTrigger ID is required');

  let providerTrigger = await providerTriggerService.getProviderTriggerById({
    providerTriggerId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerTrigger };
});

export let providerTriggerController = app.controller({
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

      let paginator = await providerTriggerService.listProviderTriggers({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerVersion
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerTriggerPresenter);
    }),

  get: providerTriggerApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),

        providerTriggerId: v.string()
      })
    )
    .do(async ctx => providerTriggerPresenter(ctx.providerTrigger))
});
