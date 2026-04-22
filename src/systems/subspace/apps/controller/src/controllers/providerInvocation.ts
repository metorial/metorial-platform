import { v } from '@lowerdeck/validation';
import { providerInvocationService } from '@metorial-subspace/module-session';
import { providerInvocationPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerInvocationController = app.controller({
  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerInvocationId: v.string()
      })
    )
    .do(async ctx => {
      let res = await providerInvocationService.getProviderInvocation({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerInvocationId: ctx.input.providerInvocationId
      });

      return providerInvocationPresenter(res);
    }),

  list: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerRunIds: v.optional(v.array(v.string())),
        sessionMessageIds: v.optional(v.array(v.string())),
        authConfigEventIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let res = await providerInvocationService.listProviderInvocations({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        inputs: {
          providerRunIds: ctx.input.providerRunIds,
          sessionMessageIds: ctx.input.sessionMessageIds,
          authConfigEventIds: ctx.input.authConfigEventIds
        }
      });

      return res.map(providerInvocationPresenter);
    })
});
