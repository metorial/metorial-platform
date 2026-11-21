import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { aiGatewayInferenceLogService } from '@metorial/module-ai-gateway';
import { aiGatewayInferenceLogPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { aiGatewayInferenceLogReadScopes, aiGatewayInstanceGroup } from './_middleware';

export let aiGatewayInferenceLogController = Controller.create(
  {
    name: 'AI gateway inference logs',
    description:
      'A record of every request made through the AI gateway: the model and provider used, tokens, cost, timing and errors. Kept for the configured log retention.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/inference-logs', 'aiGateway.inferenceLogs.list'), {
        name: 'List AI gateway inference logs',
        description:
          'Returns inference logs, newest first, without request and response content. Pages only go towards older logs: pass the after cursor of the previous page. before cursors are rejected.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayInferenceLogReadScopes] }))
      .outputList(aiGatewayInferenceLogPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            token_id: v.optional(
              v.string({ description: 'Only requests made with this AI gateway token' })
            ),
            consumer_ref: v.optional(
              v.string({
                description: 'Only requests made with tokens of this consumer reference'
              })
            ),
            model: v.optional(
              v.string({
                description: 'Only requests served by this model, by slug',
                examples: ['anthropic/claude-sonnet-4']
              })
            ),
            virtual_model_id: v.optional(
              v.string({ description: 'Only requests routed by this virtual model' })
            ),
            status: v.optional(
              v.enumOf(['succeeded', 'failed', 'cancelled', 'rejected'], {
                description: 'Only requests that ended this way'
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = aiGatewayInferenceLogService.list({
          instance: ctx.instance,
          gatewayTokenId: ctx.query.token_id,
          consumerRef: ctx.query.consumer_ref,
          modelSlug: ctx.query.model,
          virtualModelId: ctx.query.virtual_model_id,
          status: ctx.query.status
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, log => aiGatewayInferenceLogPresenter.present({ log }));
      }),

    get: aiGatewayInstanceGroup
      .get(
        instancePath(
          'ai-gateway/inference-logs/:inferenceLogId',
          'aiGateway.inferenceLogs.get'
        ),
        {
          name: 'Get AI gateway inference log',
          description:
            'Retrieves an inference log by ID. Request and response content is only returned when include_content is set.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayInferenceLogReadScopes] }))
      .output(aiGatewayInferenceLogPresenter)
      .query(
        'default',
        v.object({
          include_content: v.optional(
            v.boolean({
              description:
                'Return the stored request and response bodies. They exist only for requests made while content logging was enabled, and until their retention ends.'
            })
          )
        })
      )
      .do(async ctx => {
        let log = await aiGatewayInferenceLogService.get({
          instance: ctx.instance,
          inferenceLogId: requireParam(ctx.params, 'inferenceLogId'),
          includeContent: ctx.query.include_content ?? false
        });

        return aiGatewayInferenceLogPresenter.present({ log });
      })
  }
);
