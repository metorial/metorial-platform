import { v } from '@lowerdeck/validation';
import { knowledgeSyncService } from '@mtsrc/agent-tracking-module-knowledge';
import { knowledgePricePeriodPresenter } from './presenters/knowledgeHistory';
import { app } from './_app';
import { pricingInput } from './_pricing';

export let knowledgePriceCorrectionRoutes = {
  correct: app
    .handler()
    .input(
      v.object({
        offeringId: v.string(),
        from: v.date(),
        to: v.optional(v.date()),
        pricing: v.nullable(pricingInput),
        reason: v.string({ modifiers: [v.minLength(1), v.maxLength(500)] }),
        correctedBy: v.string({ modifiers: [v.minLength(1), v.maxLength(200)] })
      })
    )
    .do(async ctx => {
      let result = await knowledgeSyncService.correctPrices({
        offeringId: ctx.input.offeringId,
        from: ctx.input.from,
        to: ctx.input.to,
        pricing: ctx.input.pricing,
        reason: ctx.input.reason,
        correctedBy: ctx.input.correctedBy
      });

      return {
        object: 'agent_tracking#knowledge_price_correction',

        offeringId: result.offering.id,
        periods: result.periods.map(knowledgePricePeriodPresenter)
      };
    })
};
