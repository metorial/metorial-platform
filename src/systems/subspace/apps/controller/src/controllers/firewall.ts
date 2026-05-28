import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { firewallService } from '@metorial-subspace/module-enclave';
import { firewallPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let firewallBindingValidator = v.object({
  targetType: v.enumOf(['enclave', 'provider', 'network']),
  enclaveId: v.optional(v.string()),
  providerId: v.optional(v.string()),
  networkId: v.optional(v.string())
});

export let firewallApp = tenantApp.use(async ctx => {
  let firewallId = ctx.body.firewallId;
  if (!firewallId) throw new Error('Firewall ID is required');

  let firewall = await firewallService.getFirewallById({
    firewallId,
    tenant: ctx.tenant,
    environment: ctx.environment
  });

  return { firewall };
});

export let firewallController = app.controller({
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
          enclaveIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          networkPolicyIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await firewallService.listFirewalls({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        slugs: ctx.input.slugs,
        networkIds: ctx.input.networkIds,
        enclaveIds: ctx.input.enclaveIds,
        providerIds: ctx.input.providerIds,
        networkPolicyIds: ctx.input.networkPolicyIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, firewallPresenter);
    }),

  get: firewallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        firewallId: v.string()
      })
    )
    .do(async ctx => firewallPresenter(ctx.firewall)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        slug: v.optional(v.string()),
        networkId: v.string(),
        bindings: v.optional(v.array(firewallBindingValidator)),
        networkPolicyIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let firewall = await firewallService.createFirewall({
        tenant: ctx.tenant,
        environment: ctx.environment,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          slug: ctx.input.slug,
          networkId: ctx.input.networkId,
          bindings: ctx.input.bindings,
          networkPolicyIds: ctx.input.networkPolicyIds
        }
      });

      return firewallPresenter(firewall);
    }),

  update: firewallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        firewallId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        slug: v.optional(v.string()),
        networkPolicyIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let firewall = await firewallService.updateFirewall({
        firewall: ctx.firewall,
        tenant: ctx.tenant,
        environment: ctx.environment,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          slug: ctx.input.slug,
          networkPolicyIds: ctx.input.networkPolicyIds
        }
      });

      return firewallPresenter(firewall);
    }),

  delete: firewallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        firewallId: v.string()
      })
    )
    .do(async ctx => {
      await firewallService.deleteFirewall({
        firewall: ctx.firewall,
        tenant: ctx.tenant,
        environment: ctx.environment
      });

      return { deleted: true };
    }),

  addNetworkPolicy: firewallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        firewallId: v.string(),

        networkPolicyId: v.string(),
        position: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let firewall = await firewallService.addFirewallNetworkPolicy({
        firewall: ctx.firewall,
        tenant: ctx.tenant,
        environment: ctx.environment,
        networkPolicyId: ctx.input.networkPolicyId,
        position: ctx.input.position
      });

      return firewallPresenter(firewall);
    }),

  removeNetworkPolicy: firewallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        firewallId: v.string(),

        networkPolicyId: v.string()
      })
    )
    .do(async ctx => {
      let firewall = await firewallService.removeFirewallNetworkPolicy({
        firewall: ctx.firewall,
        tenant: ctx.tenant,
        environment: ctx.environment,
        networkPolicyId: ctx.input.networkPolicyId
      });

      return firewallPresenter(firewall);
    })
});
