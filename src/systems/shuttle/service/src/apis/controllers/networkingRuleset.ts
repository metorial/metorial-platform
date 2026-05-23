import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { networkingRulesetPresenter } from '../../presenters';
import { networkingRulesetService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let networkingRulesetApp = tenantApp.use(async ctx => {
  let networkingRulesetId = ctx.body.networkingRulesetId;
  if (!networkingRulesetId) throw new Error('networkingRulesetId is required');

  let networkingRuleset = await networkingRulesetService.getNetworkingRulesetById({
    tenant: ctx.tenant,
    networkingRulesetId
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
          isDefault: v.optional(v.boolean()),
          ids: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await networkingRulesetService.listNetworkingRulesets({
        tenant: ctx.tenant,

        ids: ctx.input.ids,
        isDefault: ctx.input.isDefault
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, networkingRulesetPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        isDefault: v.optional(v.boolean()),

        defaultAction: v.enumOf(['accept', 'deny']),
        rules: v.optional(
          v.array(
            v.object({
              action: v.enumOf(['accept', 'deny']),
              protocol: v.optional(v.enumOf(['tcp', 'udp', 'icmp'])),
              destination: v.optional(v.string()),
              port: v.optional(v.number()),
              portRange: v.optional(v.object({ start: v.number(), end: v.number() }))
            })
          )
        )
      })
    )
    .do(async ctx => {
      let res = await networkingRulesetService.createNetworkingRuleset({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          isDefault: ctx.input.isDefault,

          defaultAction: ctx.input.defaultAction,
          rules: ctx.input.rules ?? []
        }
      });

      return networkingRulesetPresenter(res);
    }),

  get: networkingRulesetApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        networkingRulesetId: v.string()
      })
    )
    .do(async ctx => networkingRulesetPresenter(ctx.networkingRuleset)),

  update: networkingRulesetApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        networkingRulesetId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),

        defaultAction: v.enumOf(['accept', 'deny']),
        rules: v.array(
          v.object({
            action: v.enumOf(['accept', 'deny']),
            protocol: v.optional(v.enumOf(['tcp', 'udp', 'icmp'])),
            destination: v.optional(v.string()),
            port: v.optional(v.number()),
            portRange: v.optional(v.object({ start: v.number(), end: v.number() }))
          })
        )
      })
    )
    .do(async ctx => {
      let updatedServer = await networkingRulesetService.updateNetworkingRuleset({
        networkingRuleset: ctx.networkingRuleset,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,

          defaultAction: ctx.input.defaultAction,
          rules: ctx.input.rules
        }
      });

      return networkingRulesetPresenter(updatedServer);
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        networkingRulesetIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let networkingRulesets = await networkingRulesetService.getManyNetworkingRulesetsByIds({
        tenant: ctx.tenant,
        ids: ctx.input.networkingRulesetIds
      });

      return networkingRulesets.map(networkingRulesetPresenter);
    })
});
