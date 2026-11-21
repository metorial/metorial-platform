import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { aiGatewayVirtualModelService } from '@metorial/module-ai-gateway';
import {
  aiGatewayVirtualModelInsightsPresenter,
  aiGatewayVirtualModelPresenter,
  aiGatewayVirtualModelReplayPresenter,
  aiGatewayVirtualModelTestPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  aiGatewayInstanceGroup,
  aiGatewayReadScopes,
  aiGatewayWriteScopes
} from './_middleware';
import {
  toGatewayVirtualModelDefinition,
  virtualModelDefinitionValidator,
  virtualModelDescriptionValidator,
  virtualModelDialectValidator,
  virtualModelNameValidator,
  virtualModelRequestMetadataValidator,
  virtualModelSlugValidator
} from './virtualModelDefinition';

export let aiGatewayVirtualModelGroup = aiGatewayInstanceGroup.use(async ctx => {
  let virtualModel = await aiGatewayVirtualModelService.get({
    instance: ctx.instance,
    virtualModelId: requireParam(ctx.params, 'virtualModelId')
  });

  return { virtualModel };
});

let testFields = {
  token_id: v.optional(
    v.string({
      description:
        "The AI gateway token to test as, so rules see its consumer_ref and metadata and its allowed models apply. Omit to test without a token's restrictions."
    })
  ),
  dialect: virtualModelDialectValidator,
  request: v.record(v.any(), {
    description: 'The request body to route, in the format given by dialect'
  }),
  metadata: v.optional(virtualModelRequestMetadataValidator)
};

let toTestInput = (body: {
  token_id?: string;
  dialect: 'openai_chat' | 'anthropic_messages' | 'open_responses';
  request: Record<string, any>;
  metadata?: Record<string, string>;
}) => ({
  gatewayTokenId: body.token_id,
  dialect: body.dialect,
  body: body.request,
  metadata: body.metadata
});

export let aiGatewayVirtualModelController = Controller.create(
  {
    name: 'AI gateway virtual models',
    description:
      'Virtual models are model names that pick a real model for every request, using rules, optional signals answered by a decision model, a default, and stickiness. Every change to the definition creates a new version.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/virtual-models', 'aiGateway.virtualModels.list'), {
        name: 'List AI gateway virtual models',
        description: 'Returns a paginated list of virtual models.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayVirtualModelPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = aiGatewayVirtualModelService.list({ instance: ctx.instance });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, virtualModel =>
          aiGatewayVirtualModelPresenter.present({ virtualModel })
        );
      }),

    get: aiGatewayVirtualModelGroup
      .get(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId',
          'aiGateway.virtualModels.get'
        ),
        {
          name: 'Get AI gateway virtual model',
          description: 'Retrieves a virtual model by ID or slug, with its current definition.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .output(aiGatewayVirtualModelPresenter)
      .do(async ctx =>
        aiGatewayVirtualModelPresenter.present({ virtualModel: ctx.virtualModel })
      ),

    create: aiGatewayInstanceGroup
      .post(instancePath('ai-gateway/virtual-models', 'aiGateway.virtualModels.create'), {
        name: 'Create AI gateway virtual model',
        description:
          'Creates a virtual model with its first version. Requests that use its slug as the model are routed by the definition.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          slug: virtualModelSlugValidator,
          name: virtualModelNameValidator,
          description: v.optional(virtualModelDescriptionValidator),
          definition: virtualModelDefinitionValidator
        })
      )
      .output(aiGatewayVirtualModelPresenter)
      .do(async ctx => {
        let virtualModel = await aiGatewayVirtualModelService.create({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            slug: ctx.body.slug,
            name: ctx.body.name,
            description: ctx.body.description,
            definition: toGatewayVirtualModelDefinition(ctx.body.definition)
          }
        });

        return aiGatewayVirtualModelPresenter.present({ virtualModel });
      }),

    createFromTemplate: aiGatewayInstanceGroup
      .post(
        instancePath(
          'ai-gateway/virtual-models/from-template',
          'aiGateway.virtualModels.createFromTemplate'
        ),
        {
          name: 'Create AI gateway virtual model from template',
          description:
            'Creates a virtual model from a template, filling in the models it asks for. The definition can be changed afterwards like any other.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          template: v.string({
            description: 'The slug of the template to use',
            examples: ['complexity-tiers']
          }),
          slug: virtualModelSlugValidator,
          name: virtualModelNameValidator,
          description: v.optional(virtualModelDescriptionValidator, {
            description:
              "What the virtual model is for. Defaults to the template's description."
          }),
          parameters: v.record(v.string({ modifiers: [v.minLength(1), v.maxLength(200)] }), {
            description:
              "The model for each of the template's parameters, keyed by parameter key",
            examples: [
              {
                cheap: 'openai/gpt-5-mini',
                standard: 'anthropic/claude-sonnet-4',
                premium: 'anthropic/claude-opus-4'
              }
            ]
          }),
          decision_connection_id: v.optional(
            v.string({
              description:
                "The ID of your own provider connection to run the template's decision model on. Omit to use Metorial's, billed per call."
            })
          )
        })
      )
      .output(aiGatewayVirtualModelPresenter)
      .do(async ctx => {
        let virtualModel = await aiGatewayVirtualModelService.createFromTemplate({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            templateSlug: ctx.body.template,
            slug: ctx.body.slug,
            name: ctx.body.name,
            description: ctx.body.description,
            models: ctx.body.parameters,
            decisionConnectionId: ctx.body.decision_connection_id
          }
        });

        return aiGatewayVirtualModelPresenter.present({ virtualModel });
      }),

    testDraft: aiGatewayInstanceGroup
      .post(
        instancePath('ai-gateway/virtual-models/test', 'aiGateway.virtualModels.testDraft'),
        {
          name: 'Test AI gateway virtual model draft',
          description:
            'Routes a request through an unsaved definition and shows which rule and models it picks. Nothing is sent to a provider, but the decision model is called and billed when a rule reads signals.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({ definition: virtualModelDefinitionValidator, ...testFields })
      )
      .output(aiGatewayVirtualModelTestPresenter)
      .do(async ctx => {
        let result = await aiGatewayVirtualModelService.test({
          instance: ctx.instance,
          input: {
            ...toTestInput(ctx.body),
            definition: toGatewayVirtualModelDefinition(ctx.body.definition)
          }
        });

        return aiGatewayVirtualModelTestPresenter.present({ result });
      }),

    update: aiGatewayVirtualModelGroup
      .patch(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId',
          'aiGateway.virtualModels.update'
        ),
        {
          name: 'Update AI gateway virtual model',
          description:
            'Updates the name, description or definition of a virtual model. A new definition becomes a new version and takes effect right away.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(virtualModelNameValidator),
          description: v.optional(virtualModelDescriptionValidator, {
            description: 'What the virtual model is for. Pass null to clear it.'
          }),
          definition: v.optional(virtualModelDefinitionValidator)
        })
      )
      .output(aiGatewayVirtualModelPresenter)
      .do(async ctx => {
        let virtualModel = await aiGatewayVirtualModelService.update({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            definition: ctx.body.definition
              ? toGatewayVirtualModelDefinition(ctx.body.definition)
              : undefined
          }
        });

        return aiGatewayVirtualModelPresenter.present({ virtualModel });
      }),

    delete: aiGatewayVirtualModelGroup
      .delete(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId',
          'aiGateway.virtualModels.delete'
        ),
        {
          name: 'Delete AI gateway virtual model',
          description:
            'Deletes a virtual model. Requests that use its slug are no longer routed by it, and the slug can be used again.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .output(aiGatewayVirtualModelPresenter)
      .do(async ctx => {
        let virtualModel = await aiGatewayVirtualModelService.archive({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel,
          auditScope: ctx.auditScope
        });

        return aiGatewayVirtualModelPresenter.present({ virtualModel });
      }),

    rollback: aiGatewayVirtualModelGroup
      .post(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId/rollback',
          'aiGateway.virtualModels.rollback'
        ),
        {
          name: 'Roll back AI gateway virtual model',
          description:
            "Makes an earlier version's definition current again, as a new version. The version history is kept."
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          version_id: v.string({ description: 'The ID of the version to roll back to' })
        })
      )
      .output(aiGatewayVirtualModelPresenter)
      .do(async ctx => {
        let virtualModel = await aiGatewayVirtualModelService.rollback({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel,
          auditScope: ctx.auditScope,
          versionId: ctx.body.version_id
        });

        return aiGatewayVirtualModelPresenter.present({ virtualModel });
      }),

    test: aiGatewayVirtualModelGroup
      .post(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId/test',
          'aiGateway.virtualModels.test'
        ),
        {
          name: 'Test AI gateway virtual model',
          description:
            'Routes a request through the virtual model and shows which rule and models it picks. Nothing is sent to a provider, but the decision model is called and billed when a rule reads signals.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          definition: v.optional(virtualModelDefinitionValidator, {
            description: 'A definition to test instead of the current one, without saving it'
          }),
          ...testFields
        })
      )
      .output(aiGatewayVirtualModelTestPresenter)
      .do(async ctx => {
        let result = await aiGatewayVirtualModelService.test({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel,
          input: {
            ...toTestInput(ctx.body),
            definition: ctx.body.definition
              ? toGatewayVirtualModelDefinition(ctx.body.definition)
              : undefined
          }
        });

        return aiGatewayVirtualModelTestPresenter.present({ result });
      }),

    replay: aiGatewayVirtualModelGroup
      .post(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId/replay',
          'aiGateway.virtualModels.replay'
        ),
        {
          name: 'Replay AI gateway virtual model requests',
          description:
            "Routes the virtual model's most recent logged requests again, through the current definition or a draft, and shows which would be routed differently. Only requests whose content was logged are replayed. Logged decision model answers are reused while the signals are unchanged; otherwise the decision model is called and billed."
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          definition: v.optional(virtualModelDefinitionValidator, {
            description: 'A definition to replay instead of the current one, without saving it'
          }),
          limit: v.optional(
            v.number({
              description: 'How many of the most recent requests to replay. Defaults to 20.',
              modifiers: [v.integer(), v.minValue(1), v.maxValue(50)]
            })
          )
        })
      )
      .output(aiGatewayVirtualModelReplayPresenter)
      .do(async ctx => {
        let replay = await aiGatewayVirtualModelService.replay({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel,
          input: {
            definition: ctx.body.definition
              ? toGatewayVirtualModelDefinition(ctx.body.definition)
              : undefined,
            limit: ctx.body.limit
          }
        });

        return aiGatewayVirtualModelReplayPresenter.present({ replay });
      }),

    insights: aiGatewayVirtualModelGroup
      .get(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId/insights',
          'aiGateway.virtualModels.insights.get'
        ),
        {
          name: 'Get AI gateway virtual model insights',
          description:
            'Summarizes how the virtual model routed requests over the last days: requests, failures, cost and latency per rule and model, decision model usage, and optionally the savings compared with sending everything to one model.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .query(
        'default',
        v.object({
          days: v.optional(
            v.number({
              description: 'How many days back to look. Defaults to 7.',
              preprocessors: [value => (typeof value === 'string' ? Number(value) : value)],
              modifiers: [v.integer(), v.minValue(1), v.maxValue(90)]
            })
          ),
          baseline_model: v.optional(
            v.string({
              description:
                'A model to estimate the savings against, as if it had served every request',
              examples: ['anthropic/claude-opus-4']
            })
          )
        })
      )
      .output(aiGatewayVirtualModelInsightsPresenter)
      .do(async ctx => {
        let insights = await aiGatewayVirtualModelService.insights({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel,
          input: {
            days: ctx.query.days,
            baselineModel: ctx.query.baseline_model
          }
        });

        return aiGatewayVirtualModelInsightsPresenter.present({ insights });
      })
  }
);
