import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { networkPolicyService, type NetworkPolicyRuleInput } from '@metorial-subspace/module-enclave';
import {
  networkPolicyPresenter,
  networkPolicyRulePresenter,
  networkPolicyVersionPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let networkPolicyRuleInputValidator = v.object({
  effect: v.enumOf(['allow', 'deny']),
  direction: v.enumOf(['ingress', 'egress']),
  cidrs: v.array(v.string()),
  description: v.optional(v.string()),
  enabled: v.boolean(),
  priority: v.number(),
  ports: v.optional(
    v.array(
      v.object({
        from: v.number(),
        to: v.number()
      })
    )
  )
});

export let networkPolicyApp = tenantApp.use(async ctx => {
  let networkPolicyId = ctx.body.networkPolicyId;
  if (!networkPolicyId) throw new Error('Network policy ID is required');

  let networkPolicy = await networkPolicyService.getNetworkPolicyById({
    networkPolicyId,
    tenant: ctx.tenant,
    environment: ctx.environment
  });

  return { networkPolicy };
});

export let networkPolicyController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          firewallIds: v.optional(v.array(v.string())),
          search: v.optional(v.string()),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await networkPolicyService.listNetworkPolicies({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        firewallIds: ctx.input.firewallIds,
        search: ctx.input.search,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, networkPolicyPresenter);
    }),

  get: networkPolicyApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkPolicyId: v.string()
      })
    )
    .do(async ctx => networkPolicyPresenter(ctx.networkPolicy)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        rules: v.optional(v.array(networkPolicyRuleInputValidator))
      })
    )
    .do(async ctx => {
      let networkPolicy = await networkPolicyService.createNetworkPolicy({
        tenant: ctx.tenant,
        environment: ctx.environment,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          rules: ctx.input.rules as NetworkPolicyRuleInput[] | undefined
        }
      });

      return networkPolicyPresenter(networkPolicy);
    }),

  update: networkPolicyApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkPolicyId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        rules: v.optional(v.array(networkPolicyRuleInputValidator))
      })
    )
    .do(async ctx => {
      let networkPolicy = await networkPolicyService.updateNetworkPolicy({
        networkPolicy: ctx.networkPolicy,
        tenant: ctx.tenant,
        environment: ctx.environment,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          rules: ctx.input.rules as NetworkPolicyRuleInput[] | undefined
        }
      });

      return networkPolicyPresenter(networkPolicy);
    }),

  addRule: networkPolicyApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkPolicyId: v.string(),

        effect: v.enumOf(['allow', 'deny']),
        direction: v.enumOf(['ingress', 'egress']),
        cidrs: v.array(v.string()),
        description: v.optional(v.string()),
        enabled: v.boolean(),
        priority: v.number(),
        ports: v.optional(
          v.array(
            v.object({
              from: v.number(),
              to: v.number()
            })
          )
        )
      })
    )
    .do(async ctx => {
      let { networkPolicy, rule } = await networkPolicyService.addNetworkPolicyRule({
        networkPolicy: ctx.networkPolicy,
        tenant: ctx.tenant,
        environment: ctx.environment,
        input: {
          rule: {
            effect: ctx.input.effect,
            direction: ctx.input.direction,
            cidrs: ctx.input.cidrs,
            description: ctx.input.description,
            enabled: ctx.input.enabled,
            priority: ctx.input.priority,
            ports: ctx.input.ports as NetworkPolicyRuleInput['ports']
          }
        }
      });

      return {
        networkPolicy: networkPolicyPresenter(networkPolicy),
        rule: networkPolicyRulePresenter(rule)
      };
    }),

  removeRule: networkPolicyApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkPolicyId: v.string(),
        ruleId: v.string()
      })
    )
    .do(async ctx => {
      let networkPolicy = await networkPolicyService.removeNetworkPolicyRule({
        networkPolicy: ctx.networkPolicy,
        tenant: ctx.tenant,
        environment: ctx.environment,
        ruleId: ctx.input.ruleId
      });

      return networkPolicyPresenter(networkPolicy);
    }),

  delete: networkPolicyApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkPolicyId: v.string()
      })
    )
    .do(async ctx => {
      await networkPolicyService.deleteNetworkPolicy({
        networkPolicy: ctx.networkPolicy,
        tenant: ctx.tenant,
        environment: ctx.environment
      });

      return { deleted: true };
    }),

  listVersions: networkPolicyApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          networkPolicyId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await networkPolicyService.listNetworkPolicyVersions({
        networkPolicy: ctx.networkPolicy,
        tenant: ctx.tenant,
        environment: ctx.environment
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, networkPolicyVersionPresenter);
    }),

  getVersion: networkPolicyApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkPolicyId: v.string(),
        version: v.number()
      })
    )
    .do(async ctx => {
      let networkPolicyVersion = await networkPolicyService.getNetworkPolicyVersion({
        networkPolicy: ctx.networkPolicy,
        tenant: ctx.tenant,
        environment: ctx.environment,
        version: ctx.input.version
      });

      return networkPolicyVersionPresenter(networkPolicyVersion);
    })
});
