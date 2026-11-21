import { v } from '@lowerdeck/validation';
import { billingService } from '@mtsrc/ai-gateway-module-billing';
import { projectRestrictionSchema } from '@mtsrc/ai-gateway-spec';
import { billingWindowPresenter } from '../presenters/billing';
import { platformLimitTargetPresenter } from '../presenters/platformLimit';
import { app } from './_app';

// Metorial bills the cost of requests served over its own provider keys: enterprise billing pulls
// sealed five-minute windows per gateway project and pushes credit restrictions back.
export let billingController = app.controller({
  listWindows: app
    .handler()
    .input(
      v.object({
        from: v.date(),
        to: v.date(),
        statuses: v.optional(v.array(v.enumOf(['open', 'complete']))),
        after: v.optional(v.string()),
        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(500)] })
        )
      })
    )
    .do(async ctx => {
      let page = await billingService.listWindows({
        from: ctx.input.from,
        to: ctx.input.to,
        statuses: ctx.input.statuses,
        after: ctx.input.after,
        limit: ctx.input.limit
      });

      return {
        items: page.items.map(billingWindowPresenter),
        hasMore: page.hasMore
      };
    }),

  setRestriction: app
    .handler()
    .input(v.object({ projectId: v.string(), restriction: projectRestrictionSchema }))
    .do(async ctx =>
      platformLimitTargetPresenter(
        await billingService.setRestriction({
          projectId: ctx.input.projectId,
          restriction: ctx.input.restriction
        })
      )
    )
});
