import { v } from '@lowerdeck/validation';
import { aiGatewayRoutingService } from '@metorial/module-ai-gateway';
import { aiGatewayRoutePreviewPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { aiGatewayInstanceGroup, aiGatewayReadScopes } from './_middleware';

export let aiGatewayRoutingController = Controller.create(
  {
    name: 'AI gateway routing',
    description:
      'Shows how the AI gateway routes requests for a model on this instance, without sending one.'
  },
  {
    preview: aiGatewayInstanceGroup
      .post(instancePath('ai-gateway/routing/preview', 'aiGateway.routing.preview'), {
        name: 'Preview AI gateway routing',
        description:
          "Returns the providers a request for the model would be sent to, in the order they are tried, with their pricing. Tokens' allowed models are not applied."
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .body(
        'default',
        v.object({
          model: v.string({
            description: 'The model string a request would use',
            examples: ['anthropic/claude-sonnet-4', 'openai:gpt-4o'],
            modifiers: [v.minLength(1)]
          }),
          required_features: v.optional(
            v.array(v.enumOf(['zdr']), {
              description:
                'Only route to provider connections with these features enabled. zdr: zero data retention. Instances that require zero data retention always include zdr.'
            })
          )
        })
      )
      .output(aiGatewayRoutePreviewPresenter)
      .do(async ctx => {
        let preview = await aiGatewayRoutingService.preview({
          instance: ctx.instance,
          input: {
            model: ctx.body.model,
            requiredFeatures: ctx.body.required_features
          }
        });

        return aiGatewayRoutePreviewPresenter.present({ preview });
      })
  }
);
