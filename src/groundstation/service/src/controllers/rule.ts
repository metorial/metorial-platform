import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { linkReaches } from '../entities/linkRules';
import { rulePresenter, ruleTestPresenter } from '../presenters';
import { matchSchema } from '../rules/match';
import { entityService, ruleService } from '../services';
import { organizationApp } from './_app';

let effects = ['assign', 'exclude'] as const;

let reachSchema = v.optional(v.enumOf(linkReaches));

let nameSchema = v.string({ modifiers: [v.minLength(1), v.maxLength(200)] });

let prioritySchema = v.number({
  modifiers: [v.integer(), v.minValue(-1000), v.maxValue(1000)]
});

let scopeSchema = v.optional(
  v.nullable(
    v.object({
      projectId: v.optional(v.string()),
      instanceId: v.optional(v.string())
    })
  )
);

export let ruleController = organizationApp.controller({
  create: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        name: nameSchema,
        targetEntityId: v.string(),
        effect: v.optional(v.enumOf(effects)),
        priority: v.optional(prioritySchema),
        enabled: v.optional(v.boolean()),
        scope: scopeSchema,
        match: matchSchema,

        reach: reachSchema
      })
    )
    .do(async ctx => {
      let target = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.targetEntityId
      });

      let rule = await ruleService.createRule({
        organization: ctx.organization,
        target,
        input: {
          name: ctx.input.name,
          effect: ctx.input.effect,
          priority: ctx.input.priority,
          enabled: ctx.input.enabled,
          scope: ctx.input.scope,
          match: ctx.input.match
        },
        reach: ctx.input.reach ?? 'from_now'
      });

      return rulePresenter(rule);
    }),

  update: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ruleId: v.string(),

        name: v.optional(nameSchema),
        targetEntityId: v.optional(v.string()),
        effect: v.optional(v.enumOf(effects)),
        priority: v.optional(prioritySchema),
        enabled: v.optional(v.boolean()),
        scope: scopeSchema,
        match: v.optional(matchSchema),

        reach: reachSchema
      })
    )
    .do(async ctx => {
      let rule = await ruleService.getRuleById({
        organization: ctx.organization,
        ruleId: ctx.input.ruleId
      });
      let target = ctx.input.targetEntityId
        ? await entityService.getEntityById({
            organization: ctx.organization,
            entityId: ctx.input.targetEntityId
          })
        : undefined;

      rule = await ruleService.updateRule({
        organization: ctx.organization,
        rule,
        target,
        input: {
          name: ctx.input.name,
          effect: ctx.input.effect,
          priority: ctx.input.priority,
          enabled: ctx.input.enabled,
          scope: ctx.input.scope,
          match: ctx.input.match
        },
        reach: ctx.input.reach ?? 'from_now'
      });

      return rulePresenter(rule);
    }),

  delete: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ruleId: v.string(),
        reach: reachSchema
      })
    )
    .do(async ctx => {
      let rule = await ruleService.getRuleById({
        organization: ctx.organization,
        ruleId: ctx.input.ruleId
      });

      rule = await ruleService.deleteRule({
        organization: ctx.organization,
        rule,
        reach: ctx.input.reach ?? 'from_now'
      });

      return rulePresenter(rule);
    }),

  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), ruleId: v.string() }))
    .do(async ctx => {
      let rule = await ruleService.getRuleById({
        organization: ctx.organization,
        ruleId: ctx.input.ruleId
      });

      return rulePresenter(rule);
    }),

  list: organizationApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          organizationId: v.string(),

          targetEntityIds: v.optional(v.array(v.string())),
          enabled: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await ruleService.listRules({
        organization: ctx.organization,
        targetEntityIds: ctx.input.targetEntityIds,
        enabled: ctx.input.enabled
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, rulePresenter);
    }),

  test: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        ruleId: v.optional(v.string()),

        targetEntityId: v.string(),
        effect: v.optional(v.enumOf(effects)),
        priority: v.optional(prioritySchema),
        scope: scopeSchema,
        match: matchSchema
      })
    )
    .do(async ctx => {
      let [target, rule] = await Promise.all([
        entityService.getEntityById({
          organization: ctx.organization,
          entityId: ctx.input.targetEntityId
        }),
        ctx.input.ruleId
          ? ruleService.getRuleById({
              organization: ctx.organization,
              ruleId: ctx.input.ruleId
            })
          : undefined
      ]);

      let result = await ruleService.testRule({
        organization: ctx.organization,
        target,
        rule,
        input: {
          effect: ctx.input.effect,
          priority: ctx.input.priority,
          scope: ctx.input.scope,
          match: ctx.input.match
        }
      });

      return ruleTestPresenter(result);
    })
});
