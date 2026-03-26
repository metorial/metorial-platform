import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  networkingRulesetPresenter,
  networkingRulesetService
} from '@metorial-subspace/provider-shuttle';
import { app } from './_app';
import { tenantApp } from './tenant';

export let networkingRulesetApp = tenantApp.use(async ctx => {
  let networkingRulesetId = ctx.body.networkingRulesetId;
  if (!networkingRulesetId) throw new Error('NetworkingRuleset ID is required');

  let networkingRuleset = await networkingRulesetService.getNetworkingRulesetById({
    networkingRulesetId,
    tenant: ctx.tenant
  });

  return { networkingRuleset };
});

export let networkingRulesetController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await networkingRulesetService.listNetworkingRulesets({
        tenant: ctx.tenant,
        ...ctx.input
      });

      return {
        ...paginator,
        items: paginator.items.map(item => networkingRulesetPresenter(item))
      };
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        isDefault: v.optional(v.boolean()),
        defaultAction: v.enumOf(['accept', 'deny']),
        rules: v.array(
          v.object({
            action: v.enumOf(['accept', 'deny']),
            protocol: v.optional(v.enumOf(['tcp', 'udp', 'icmp'])),
            destination: v.optional(v.string()),
            port: v.optional(v.number()),
            portRange: v.object({
              start: v.number(),
              end: v.number()
            })
          })
        )
      })
    )
    .do(async ctx => {
      let res = await networkingRulesetService.createNetworkingRulesetById({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          isDefault: ctx.input.isDefault,
          defaultAction: ctx.input.defaultAction,
          rules: ctx.input.rules as any
        }
      });

      return networkingRulesetPresenter(res);
    }),

  get: networkingRulesetApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkingRulesetId: v.string()
      })
    )
    .do(async ctx => networkingRulesetPresenter(ctx.networkingRuleset)),

  update: networkingRulesetApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        networkingRulesetId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        defaultAction: v.optional(v.enumOf(['accept', 'deny'])),
        rules: v.optional(
          v.array(
            v.object({
              action: v.enumOf(['accept', 'deny']),
              protocol: v.optional(v.enumOf(['tcp', 'udp', 'icmp'])),
              destination: v.optional(v.string()),
              port: v.optional(v.number()),
              portRange: v.object({
                start: v.number(),
                end: v.number()
              })
            })
          )
        )
      })
    )
    .do(async ctx => {
      let res = await networkingRulesetService.updateNetworkingRuleset({
        networkingRuleset: ctx.networkingRuleset,
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          defaultAction: ctx.input.defaultAction,
          rules: ctx.input.rules as any
        }
      });

      return networkingRulesetPresenter(res);
    })
});
