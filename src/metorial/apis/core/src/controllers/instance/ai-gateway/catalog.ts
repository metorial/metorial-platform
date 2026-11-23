import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { aiGatewayCatalogService } from '@metorial/module-ai-gateway';
import {
  aiGatewayLabPresenter,
  aiGatewayModelOfferingPresenter,
  aiGatewayModelPresenter,
  aiGatewayModelResolutionPresenter,
  aiGatewayProviderPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { aiGatewayInstanceGroup, aiGatewayReadScopes } from './_middleware';

export let aiGatewayModelGroup = aiGatewayInstanceGroup.use(async ctx => {
  let model = await aiGatewayCatalogService.getModel({
    modelId: requireParam(ctx.params, 'modelId')
  });

  return { model };
});

export let aiGatewayLabController = Controller.create(
  {
    name: 'AI gateway labs',
    description:
      'The labs that make the models in the AI gateway catalog, e.g. Anthropic or OpenAI.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/labs', 'aiGateway.labs.list'), {
        name: 'List AI gateway labs',
        description: 'Returns a paginated list of the labs in the catalog.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayLabPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = aiGatewayCatalogService.listLabs();
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, lab => aiGatewayLabPresenter.present({ lab }));
      })
  }
);

export let aiGatewayProviderController = Controller.create(
  {
    name: 'AI gateway providers',
    description:
      'The providers that serve models in the AI gateway catalog, e.g. OpenAI, Amazon Bedrock or OpenRouter.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/providers', 'aiGateway.providers.list'), {
        name: 'List AI gateway providers',
        description:
          'Returns a paginated list of the providers in the catalog, including whether you can connect your own account for each.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayProviderPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = aiGatewayCatalogService.listProviders();
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, provider =>
          aiGatewayProviderPresenter.present({ provider })
        );
      })
  }
);

export let aiGatewayModelController = Controller.create(
  {
    name: 'AI gateway models',
    description:
      'The models in the AI gateway catalog, with their capabilities and limits. The catalog is shared by all instances and kept up to date by Metorial.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/models', 'aiGateway.models.list'), {
        name: 'List AI gateway models',
        description:
          'Returns a paginated list of the models in the catalog that are not retired.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayModelPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            lab: v.optional(
              v.string({
                description: 'Only models made by the lab with this slug',
                examples: ['anthropic']
              })
            ),
            kind: v.optional(
              v.string({
                description:
                  'Only models of this kind: chat, embedding, reranking, image, video, speech, transcription, realtime, audio, decision or other',
                examples: ['chat']
              })
            ),
            search: v.optional(
              v.string({
                description: 'Only models whose slug or name contains this text',
                examples: ['sonnet'],
                modifiers: [v.maxLength(200)]
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = aiGatewayCatalogService.listModels({
          labSlug: ctx.query.lab,
          kind: ctx.query.kind,
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, model => aiGatewayModelPresenter.present({ model }));
      }),

    get: aiGatewayModelGroup
      .get(instancePath('ai-gateway/models/:modelId', 'aiGateway.models.get'), {
        name: 'Get AI gateway model',
        description:
          'Retrieves a model by ID or slug. URL-encode the slash of a slug, e.g. anthropic%2Fclaude-sonnet-4.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .output(aiGatewayModelPresenter)
      .do(async ctx => aiGatewayModelPresenter.present({ model: ctx.model })),

    resolve: aiGatewayInstanceGroup
      .post(instancePath('ai-gateway/models/resolve', 'aiGateway.models.resolve'), {
        name: 'Resolve AI gateway model',
        description:
          'Finds the catalog model a model string refers to, the same way the gateway does for requests. Accepts slugs, names providers use for a model, and provider-pinned names like openai:gpt-4o.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .body(
        'default',
        v.object({
          model: v.string({
            description: 'The model string to resolve, as it would be sent to the gateway',
            examples: ['claude-sonnet-4-20250514', 'openai:gpt-4o'],
            modifiers: [v.minLength(1)]
          })
        })
      )
      .output(aiGatewayModelResolutionPresenter)
      .do(async ctx => {
        let resolution = await aiGatewayCatalogService.resolveModel({ model: ctx.body.model });

        return aiGatewayModelResolutionPresenter.present({ resolution });
      })
  }
);

export let aiGatewayModelOfferingController = Controller.create(
  {
    name: 'AI gateway model offerings',
    description:
      'How each provider serves a model: its id for the model, pricing, limits and capabilities.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/model-offerings', 'aiGateway.modelOfferings.list'), {
        name: 'List AI gateway model offerings',
        description:
          'Returns a paginated list of the offerings in the catalog that are not retired.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayModelOfferingPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            model_id: v.optional(
              v.string({
                description: 'Only offerings of the model with this ID or slug',
                examples: ['anthropic/claude-sonnet-4']
              })
            ),
            provider: v.optional(
              v.string({
                description: 'Only offerings of the provider with this slug',
                examples: ['bedrock']
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = aiGatewayCatalogService.listOfferings({
          modelId: ctx.query.model_id,
          providerSlug: ctx.query.provider
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, offering =>
          aiGatewayModelOfferingPresenter.present({ offering })
        );
      })
  }
);
