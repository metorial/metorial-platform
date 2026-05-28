import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { firewallBindingService } from '@metorial-subspace/module-enclave';
import { firewallBindingPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let firewallBindingInputValidator = v.object({
  targetType: v.enumOf(['enclave', 'provider', 'network']),
  enclaveId: v.optional(v.string()),
  providerId: v.optional(v.string()),
  networkId: v.optional(v.string())
});

export let firewallBindingApp = tenantApp.use(async ctx => {
  let firewallBindingId = ctx.body.firewallBindingId;
  if (!firewallBindingId) throw new Error('Firewall binding ID is required');

  let firewallBinding = await firewallBindingService.getFirewallBindingById({
    firewallBindingId,
    tenant: ctx.tenant,
    environment: ctx.environment
  });

  return { firewallBinding };
});

export let firewallBindingController = app.controller({
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
          providerIds: v.optional(v.array(v.string())),
          networkIds: v.optional(v.array(v.string())),
          targetTypes: v.optional(v.array(v.enumOf(['enclave', 'provider', 'network']))),

          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await firewallBindingService.listFirewallBindings({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        firewallIds: ctx.input.firewallIds,
        enclaveIds: ctx.input.enclaveIds,
        providerIds: ctx.input.providerIds,
        networkIds: ctx.input.networkIds,
        targetTypes: ctx.input.targetTypes,
        createdAt: ctx.input.createdAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, firewallBindingPresenter);
    }),

  get: firewallBindingApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        firewallBindingId: v.string()
      })
    )
    .do(async ctx => firewallBindingPresenter(ctx.firewallBinding)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        firewallId: v.string(),
        targetType: v.enumOf(['enclave', 'provider', 'network']),
        enclaveId: v.optional(v.string()),
        providerId: v.optional(v.string()),
        networkId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let firewallBinding = await firewallBindingService.createFirewallBinding({
        tenant: ctx.tenant,
        environment: ctx.environment,
        firewallId: ctx.input.firewallId,
        input: {
          targetType: ctx.input.targetType,
          enclaveId: ctx.input.enclaveId,
          providerId: ctx.input.providerId,
          networkId: ctx.input.networkId
        }
      });

      return firewallBindingPresenter(firewallBinding);
    }),

  delete: firewallBindingApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        firewallBindingId: v.string()
      })
    )
    .do(async ctx => {
      await firewallBindingService.deleteFirewallBinding({
        firewallBinding: ctx.firewallBinding,
        tenant: ctx.tenant,
        environment: ctx.environment
      });

      return { deleted: true };
    })
});
