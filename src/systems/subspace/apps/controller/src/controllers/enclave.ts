import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { enclaveNetworkLogService, enclaveService } from '@metorial-subspace/module-enclave';
import { enclavePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let enclaveApp = tenantApp.use(async ctx => {
  let enclaveId = ctx.body.enclaveId;
  if (!enclaveId) throw new Error('Enclave ID is required');

  let enclave = await enclaveService.getEnclaveById({
    enclaveId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { enclave };
});

export let enclaveController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          slugs: v.optional(v.array(v.string())),
          networkIds: v.optional(v.array(v.string())),
          enclaveEnvironmentIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          firewallIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await enclaveService.listEnclaves({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        slugs: ctx.input.slugs,
        networkIds: ctx.input.networkIds,
        enclaveEnvironmentIds: ctx.input.enclaveEnvironmentIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerIds: ctx.input.providerIds,
        firewallIds: ctx.input.firewallIds,
        createdAt: ctx.input.createdAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, enclavePresenter);
    }),

  get: enclaveApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        enclaveId: v.string()
      })
    )
    .do(async ctx => enclavePresenter(ctx.enclave)),

  update: enclaveApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        enclaveId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let enclave = await enclaveService.updateEnclave({
        enclave: ctx.enclave,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          name: ctx.input.name,
          description: ctx.input.description
        }
      });

      return enclavePresenter(enclave);
    }),

  listNetworkLogs: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        enclaveIds: v.optional(v.array(v.string())),
        hostnames: v.optional(v.array(v.string())),
        ips: v.optional(v.array(v.string())),
        from: v.optional(v.string()),
        to: v.optional(v.string()),
        intervalMinutes: v.optional(v.number())
      })
    )
    .do(async ctx =>
      enclaveNetworkLogService.listNetworkLogs({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        enclaveIds: ctx.input.enclaveIds,
        filters: {
          hostnames: ctx.input.hostnames,
          ips: ctx.input.ips,
          from: ctx.input.from,
          to: ctx.input.to,
          intervalMinutes: ctx.input.intervalMinutes
        }
      })
    )
});
