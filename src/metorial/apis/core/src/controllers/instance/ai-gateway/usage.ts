import { v } from '@lowerdeck/validation';
import { aiGatewayConsumerService, aiGatewayUsageService } from '@metorial/module-ai-gateway';
import { aiGatewayUsageTimelinePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { aiGatewayInstanceGroup, aiGatewayReadScopes } from './_middleware';

export let aiGatewayUsageController = Controller.create(
  {
    name: 'AI gateway usage',
    description:
      'Requests, tokens and cost of the AI gateway over time. Built from inference logs, so it covers the configured log retention.'
  },
  {
    timeline: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/usage/timeline', 'aiGateway.usage.timeline'), {
        name: 'Get AI gateway usage timeline',
        description:
          'Returns usage in fixed-width buckets aligned to UTC, oldest first. A range can span at most 1500 buckets.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .query(
        'default',
        v.object({
          from: v.date({
            description: 'Start of the range, inclusive. Rounded down to a whole interval.'
          }),
          to: v.date({ description: 'End of the range, exclusive. Must be after from.' }),
          interval: v.optional(
            v.enumOf(['5m', '15m', '1h', '6h', '1d'], {
              description:
                'The width of every bucket. Omit to pick the smallest interval that gives at most 500 buckets.'
            })
          ),
          token_id: v.optional(
            v.string({ description: 'Only requests made with this AI gateway token' })
          ),
          consumer_id: v.optional(
            v.string({ description: 'Only requests made with tokens of this consumer' })
          ),
          model: v.optional(
            v.string({
              description: 'Only requests served by this model, by slug',
              examples: ['anthropic/claude-sonnet-4']
            })
          ),
          virtual_model_id: v.optional(
            v.string({ description: 'Only requests routed by this virtual model' })
          )
        })
      )
      .output(aiGatewayUsageTimelinePresenter)
      .do(async ctx => {
        let consumerRef = ctx.query.consumer_id
          ? await aiGatewayConsumerService.resolveRef({
              instance: ctx.instance,
              consumerId: ctx.query.consumer_id
            })
          : undefined;

        let usage = await aiGatewayUsageService.timeline({
          instance: ctx.instance,
          input: {
            from: ctx.query.from,
            to: ctx.query.to,
            interval: ctx.query.interval,
            gatewayTokenId: ctx.query.token_id,
            consumerRef,
            modelSlug: ctx.query.model,
            virtualModelId: ctx.query.virtual_model_id
          }
        });

        return aiGatewayUsageTimelinePresenter.present({ usage });
      })
  }
);
