import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { networkService } from '@metorial-subspace/module-enclave';
import { networkPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let networkController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          firewallIds: v.optional(v.array(v.string())),
          enclaveIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await networkService.listNetworks({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        firewallIds: ctx.input.firewallIds,
        enclaveIds: ctx.input.enclaveIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, networkPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string()
      })
    )
    .do(async ctx => {
      let network = await networkService.getNetworkForEnvironment({
        tenant: ctx.tenant,
        environment: ctx.environment
      });

      return networkPresenter(network);
    })
});
