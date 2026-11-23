import { v } from '@lowerdeck/validation';
import type {
  aiGatewayVirtualModelService,
  AiGatewayVirtualModelVersion
} from '@metorial/module-ai-gateway';
import { Presenter } from '@metorial/presenter';
import {
  aiGatewayVirtualModelInsightsType,
  aiGatewayVirtualModelReplayType,
  aiGatewayVirtualModelTemplateType,
  aiGatewayVirtualModelTestType,
  aiGatewayVirtualModelType,
  aiGatewayVirtualModelVersionType
} from '../../types';
import { aiGatewayRouteCandidateSchema, presentAiGatewayRouteCandidate } from './_shared';
import {
  aiGatewayParameterOverridesSchema,
  aiGatewayVirtualModelDefinitionSchema,
  presentAiGatewayParameterOverrides,
  presentAiGatewayVirtualModelDefinition
} from './virtualModelDefinition';

type TestResult = Awaited<ReturnType<typeof aiGatewayVirtualModelService.test>>;
type RouteLog = NonNullable<TestResult['virtualModel']>;
type RuleTrace = RouteLog['trace'][number];
type DecisionLog = NonNullable<RouteLog['decision']>;
type SignalValue = NonNullable<DecisionLog['signals']>[string];
type Candidate = TestResult['candidates'][number];

// The gateway types these as always set, but replays without targets and empty averages are null.
let orNull = <T>(value: T | null | undefined): T | null => value ?? null;

let presentVersion = (version: AiGatewayVirtualModelVersion) => ({
  object: 'ai_gateway.virtual_model.version' as const,

  id: version.id,
  number: version.number,
  definition: presentAiGatewayVirtualModelDefinition(version.definition),
  target_models: version.targetModelSlugs,

  created_at: version.createdAt
});

let versionSchema = v.object({
  object: v.literal('ai_gateway.virtual_model.version', {
    description: "String representing the object's type"
  }),

  id: v.string({ description: "The version's unique identifier" }),
  number: v.number({
    description: 'The version number, counting up from 1 with every change to the definition'
  }),
  definition: aiGatewayVirtualModelDefinitionSchema,
  target_models: v.array(v.string(), {
    description: 'The catalog slugs of every model the definition can route to'
  }),

  created_at: v.date({ description: 'When the version was created' })
});

let presentSignalValue = (signal: SignalValue) => {
  if (signal.type == 'boolean') {
    return { type: signal.type, value: signal.value, probability: signal.probability };
  }

  if (signal.type == 'choice') {
    return {
      type: signal.type,
      choice: signal.choice,
      probability: signal.probability,
      confidence: signal.confidence,
      probabilities: signal.probabilities
    };
  }

  return {
    type: signal.type,
    score: signal.score,
    level: signal.level,
    probability: signal.probability,
    confidence: signal.confidence,
    probabilities: signal.probabilities
  };
};

let presentDecision = (decision: DecisionLog | null) =>
  decision
    ? {
        model: decision.model,
        source: decision.source,
        cached: decision.cached,
        latency_ms: decision.latencyMs,
        input_tokens: decision.inputTokens,
        cost_usd: decision.costUsd,
        signals: decision.signals
          ? Object.fromEntries(
              Object.entries(decision.signals).map(([name, signal]) => [
                name,
                presentSignalValue(signal)
              ])
            )
          : null,
        error: decision.error
          ? { code: decision.error.code, message: decision.error.message }
          : null
      }
    : null;

let presentTrace = (trace: RuleTrace[]) =>
  trace.map(entry => ({
    rule_id: entry.ruleId,
    outcome: entry.outcome,
    error: entry.error ?? null
  }));

let probability = v.number({
  description: 'The probability of the picked answer, from 0 to 1'
});

let confidence = v.number({
  description: "The decision model's own confidence in its answer, from 0 to 1"
});

let signalValueSchema = v.union([
  v.object({
    type: v.literal('boolean', { description: 'A yes or no signal' }),
    value: v.boolean({
      description: 'The answer, true when probability is at least 0.5'
    }),
    probability: v.number({ description: 'The probability of yes, from 0 to 1' })
  }),
  v.object({
    type: v.literal('choice', { description: 'A choice signal' }),
    choice: v.string({ description: 'The option picked' }),
    probability,
    confidence,
    probabilities: v.record(v.number(), {
      description: 'The probability of every option, keyed by option'
    })
  }),
  v.object({
    type: v.literal('score', { description: 'A score signal' }),
    score: v.number({
      description:
        "The decision model's score on the scale of levels, which can fall between two levels"
    }),
    level: v.number({ description: 'The most likely level, counting from 0' }),
    probability,
    confidence,
    probabilities: v.array(v.number(), { description: 'The probability of every level' })
  })
]);

let decisionSchema = v.nullable(
  v.object(
    {
      model: v.enumOf(['clef-flash', 'clef', 'jev'], {
        description: 'The decision model that was asked'
      }),
      source: v.nullable(
        v.enumOf(['customer', 'platform'], {
          description:
            "Whose connection ran the decision model: customer for your own provider connection, platform for Metorial's, billed to you. Null when it was not called."
        })
      ),
      cached: v.boolean({
        description:
          'Whether earlier answers were reused instead of calling the decision model'
      }),
      latency_ms: v.number({ description: 'How long the decision took, in milliseconds' }),
      input_tokens: v.number({ description: 'The input tokens the decision model read' }),
      cost_usd: v.number({ description: 'What the decision cost, in USD' }),
      signals: v.nullable(
        v.record(signalValueSchema, {
          description:
            'The answer to every signal, keyed by signal name. Rules read them as signals.<name>.<field>. Null if the decision failed.'
        })
      ),
      error: v.nullable(
        v.object(
          {
            code: v.enumOf(
              [
                'timeout',
                'unreachable',
                'rate_limited',
                'rejected',
                'invalid_response',
                'unavailable'
              ],
              { description: 'Why the decision model failed' }
            ),
            message: v.string({ description: 'A description of the failure' })
          },
          { description: 'Why the decision failed. Null if it succeeded.' }
        )
      )
    },
    {
      description:
        'The decision model call made to answer the signals. Null when no rule that reads signals was reached.'
    }
  )
);

let traceSchema = v.array(
  v.object({
    rule_id: v.string({ description: 'The rule that was evaluated' }),
    outcome: v.enumOf(['matched', 'not_matched', 'error', 'signals_unavailable'], {
      description:
        'The result. signals_unavailable means the rule reads signals but the decision model failed, so it was skipped.'
    }),
    error: v.nullable(
      v.string({ description: 'Why evaluating the expression failed, for error outcomes' })
    )
  }),
  { description: 'Every rule evaluated, in order, up to the one that matched' }
);

let ruleId = v.nullable(
  v.string({ description: 'The rule that picked the model. Null when the default was used.' })
);

let presentCandidate = (candidate: Candidate) => ({
  model: candidate.model.slug,
  requested_model: candidate.requestedModel,
  ...presentAiGatewayRouteCandidate(candidate)
});

let presentRoute = (route: RouteLog) => {
  let isDraft = route.versionNumber == 0;

  return {
    version_id: isDraft ? null : route.versionId,
    version_number: isDraft ? null : route.versionNumber,
    rule_id: route.ruleId,
    reason: route.reason,
    trace: presentTrace(route.trace),
    models: route.targets,
    skipped_models: route.skippedTargets.map(target => ({
      model: target.model,
      reason: target.reason
    })),
    decision: presentDecision(route.decision)
  };
};

export let v1AiGatewayVirtualModelPresenter = Presenter.create(aiGatewayVirtualModelType)
  .presenter(async ({ virtualModel }) => ({
    object: 'ai_gateway.virtual_model' as const,

    id: virtualModel.id,
    slug: virtualModel.slug,
    name: virtualModel.name,
    description: virtualModel.description,

    current_version: virtualModel.currentVersion
      ? presentVersion(virtualModel.currentVersion)
      : null,
    warnings: virtualModel.warnings,

    created_at: virtualModel.createdAt,
    updated_at: virtualModel.updatedAt,
    deleted_at: virtualModel.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.virtual_model', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The virtual model's unique identifier" }),
      slug: v.string({
        description:
          'The model name to send in AI gateway requests to use this virtual model. Unique within the instance.',
        examples: ['smart-router']
      }),
      name: v.string({ description: "The virtual model's name" }),
      description: v.nullable(v.string({ description: 'What the virtual model is for' })),

      current_version: v.nullable(versionSchema),
      warnings: v.array(v.string(), {
        description:
          'Things to check about the definition that did not prevent saving it, e.g. a slug that also names a catalog model. Only returned when the virtual model is created, updated or rolled back.'
      }),

      created_at: v.date({ description: 'When the virtual model was created' }),
      updated_at: v.date({ description: 'When the virtual model was last changed' }),
      deleted_at: v.nullable(v.date({ description: 'When the virtual model was deleted' }))
    })
  )
  .build();

export let v1AiGatewayVirtualModelVersionPresenter = Presenter.create(
  aiGatewayVirtualModelVersionType
)
  .presenter(async ({ version }) => presentVersion(version))
  .schema(versionSchema)
  .build();

export let v1AiGatewayVirtualModelTemplatePresenter = Presenter.create(
  aiGatewayVirtualModelTemplateType
)
  .presenter(async ({ template }) => ({
    object: 'ai_gateway.virtual_model.template' as const,

    slug: template.slug,
    name: template.name,
    description: template.description,
    parameters: template.parameters.map(parameter => ({
      key: parameter.key,
      name: parameter.name,
      description: parameter.description
    })),
    uses_decision_model: template.usesDecisionModel
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.virtual_model.template', {
        description: "String representing the object's type"
      }),

      slug: v.string({
        description: 'The identifier to create a virtual model from the template with',
        examples: ['complexity-tiers']
      }),
      name: v.string({ description: "The template's name" }),
      description: v.string({ description: 'How virtual models made from it route requests' }),
      parameters: v.array(
        v.object({
          key: v.string({
            description: 'The key to pass the model under when creating from the template',
            examples: ['cheap']
          }),
          name: v.string({ description: "The parameter's name" }),
          description: v.string({ description: 'What the model is used for' })
        }),
        { description: 'The models to choose when creating a virtual model from the template' }
      ),
      uses_decision_model: v.boolean({
        description:
          'Whether the template asks a decision model about each request, which is billed per call'
      })
    })
  )
  .build();

export let v1AiGatewayVirtualModelTestPresenter = Presenter.create(
  aiGatewayVirtualModelTestType
)
  .presenter(async ({ result }) => ({
    object: 'ai_gateway.virtual_model.test' as const,

    request: {
      dialect: result.request.dialect,
      input_tokens: result.request.estimatedInputTokens,
      message_count: result.request.messageCount,
      user_turns: result.request.userTurns,
      is_continuation: result.request.isContinuation,
      has_images: result.request.hasImages,
      has_files: result.request.hasFiles,
      has_audio: result.request.hasAudio,
      tool_count: result.request.toolCount
    },
    route: result.virtualModel ? presentRoute(result.virtualModel) : null,
    overrides: presentAiGatewayParameterOverrides(result.overrides),
    candidates: result.candidates.map(presentCandidate)
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.virtual_model.test', {
        description: "String representing the object's type"
      }),

      request: v.object(
        {
          dialect: v.enumOf(['openai_chat', 'anthropic_messages', 'open_responses'], {
            description: 'The API format the request was read as'
          }),
          input_tokens: v.number({
            description:
              'The estimated input tokens, as rules read them in request.input_tokens'
          }),
          message_count: v.number({ description: 'The number of messages' }),
          user_turns: v.number({ description: 'The number of user messages' }),
          is_continuation: v.boolean({
            description: 'Whether the latest message is a tool result, as in an agent loop'
          }),
          has_images: v.boolean({ description: 'Whether the request contains images' }),
          has_files: v.boolean({ description: 'Whether the request contains files' }),
          has_audio: v.boolean({ description: 'Whether the request contains audio' }),
          tool_count: v.number({ description: 'The number of tools the request offers' })
        },
        {
          description:
            'What the gateway read from the request. Rules see these values under request.'
        }
      ),
      route: v.nullable(
        v.object(
          {
            version_id: v.nullable(
              v.string({
                description:
                  'The version that routed the request. Null for a draft definition.'
              })
            ),
            version_number: v.nullable(
              v.number({
                description: 'The number of that version. Null for a draft definition.'
              })
            ),
            rule_id: ruleId,
            reason: v.enumOf(['rule', 'default', 'sticky'], {
              description:
                'Why the models were picked: a rule matched, no rule matched, or the conversation is pinned by stickiness'
            }),
            trace: traceSchema,
            models: v.array(v.string(), {
              description: 'The models picked, in the order they are tried'
            }),
            skipped_models: v.array(
              v.object({
                model: v.string({ description: 'The model that was left out' }),
                reason: v.enumOf(
                  [
                    'image_input',
                    'audio_input',
                    'file_input',
                    'context_window',
                    'tools',
                    'unknown_model',
                    'unavailable'
                  ],
                  {
                    description:
                      'Why: the model cannot read images, audio or files, the request exceeds its context window, it cannot call tools, it is not in the catalog, or no provider can serve it'
                  }
                )
              }),
              { description: 'Models of the picked rule that cannot handle the request' }
            ),
            decision: decisionSchema
          },
          { description: 'How the virtual model routed the request' }
        )
      ),
      overrides: aiGatewayParameterOverridesSchema,
      candidates: v.array(
        aiGatewayRouteCandidateSchema({
          model: v.string({ description: 'The catalog slug of the model' }),
          requested_model: v.string({
            description: 'The model as written in the definition'
          })
        }),
        {
          description:
            'Where the request would be sent, in the order tried. Nothing is sent to a provider during a test.'
        }
      )
    })
  )
  .build();

export let v1AiGatewayVirtualModelReplayPresenter = Presenter.create(
  aiGatewayVirtualModelReplayType
)
  .presenter(async ({ replay }) => ({
    object: 'ai_gateway.virtual_model.replay' as const,

    results: replay.results.map(result => ({
      inference_log_id: result.logId,
      received_at: result.receivedAt,
      original: { rule_id: result.original.ruleId, model: result.original.model },
      replayed: result.replayed
        ? {
            rule_id: result.replayed.ruleId,
            model: orNull(result.replayed.model),
            trace: presentTrace(result.replayed.trace),
            decision: presentDecision(result.replayed.decision)
          }
        : null,
      changed: result.changed,
      error: result.error
    })),
    summary: {
      replayed: replay.summary.replayed,
      changed: replay.summary.changed,
      decision_cost_usd: replay.summary.decisionCostUsd
    }
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.virtual_model.replay', {
        description: "String representing the object's type"
      }),

      results: v.array(
        v.object({
          inference_log_id: v.string({ description: 'The logged request that was replayed' }),
          received_at: v.date({ description: 'When the logged request was received' }),
          original: v.object(
            {
              rule_id: ruleId,
              model: v.nullable(v.string({ description: 'The model that served the request' }))
            },
            { description: 'How the request was routed when it was made' }
          ),
          replayed: v.nullable(
            v.object(
              {
                rule_id: ruleId,
                model: v.nullable(
                  v.string({ description: 'The first model that would be tried' })
                ),
                trace: traceSchema,
                decision: decisionSchema
              },
              { description: 'How the definition routes the request now. Null if it failed.' }
            )
          ),
          changed: v.boolean({
            description: 'Whether the rule or the first model differs from the original'
          }),
          error: v.nullable(v.string({ description: 'Why replaying the request failed' }))
        }),
        { description: 'One result per replayed request, newest first' }
      ),
      summary: v.object({
        replayed: v.number({ description: 'How many requests were replayed' }),
        changed: v.number({ description: 'How many would be routed differently' }),
        decision_cost_usd: v.number({
          description:
            'What the decision model calls of the replay cost, in USD. Logged answers are reused when the signals are unchanged.'
        })
      })
    })
  )
  .build();

export let v1AiGatewayVirtualModelInsightsPresenter = Presenter.create(
  aiGatewayVirtualModelInsightsType
)
  .presenter(async ({ insights }) => ({
    object: 'ai_gateway.virtual_model.insights' as const,

    since: insights.since,
    days: insights.days,
    routes: insights.routes.map(route => ({
      rule_id: route.ruleId,
      model: route.model,
      requests: route.requests,
      failed: route.failed,
      billed_usd: route.billedUsd,
      input_tokens: route.inputTokens,
      output_tokens: route.outputTokens,
      avg_total_ms: orNull(route.avgTotalMs)
    })),
    decision: {
      calls: insights.decision.calls,
      cached: insights.decision.cached,
      failed: insights.decision.failed,
      cost_usd: insights.decision.costUsd,
      avg_latency_ms: orNull(insights.decision.avgLatencyMs)
    },
    billed_usd: insights.billedUsd,
    savings: insights.savings
      ? {
          baseline_model: insights.savings.baselineModel,
          baseline_usd: insights.savings.baselineUsd,
          spent_usd: insights.savings.spentUsd,
          saved_usd: insights.savings.savedUsd,
          priced: insights.savings.priced
        }
      : null
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.virtual_model.insights', {
        description: "String representing the object's type"
      }),

      since: v.date({ description: 'The start of the period the insights cover' }),
      days: v.number({ description: 'The length of the period, in days' }),
      routes: v.array(
        v.object({
          rule_id: ruleId,
          model: v.nullable(
            v.string({ description: 'The model that served the requests. Null if none did.' })
          ),
          requests: v.number({ description: 'The number of requests' }),
          failed: v.number({ description: 'How many of them failed' }),
          billed_usd: v.number({ description: 'What they were billed, in USD' }),
          input_tokens: v.number({ description: 'Their input tokens' }),
          output_tokens: v.number({ description: 'Their output tokens' }),
          avg_total_ms: v.nullable(
            v.number({ description: 'Their average total duration, in milliseconds' })
          )
        }),
        {
          description:
            'Requests grouped by the rule and model that served them, most used first'
        }
      ),
      decision: v.object(
        {
          calls: v.number({ description: 'Requests that needed the decision model' }),
          cached: v.number({ description: 'How many of them reused earlier answers' }),
          failed: v.number({ description: 'How many of them failed' }),
          cost_usd: v.number({ description: 'What the decision model cost, in USD' }),
          avg_latency_ms: v.nullable(
            v.number({ description: 'The average decision latency, in milliseconds' })
          )
        },
        { description: 'Decision model usage in the period' }
      ),
      billed_usd: v.number({
        description: 'What all requests were billed, in USD, excluding the decision model'
      }),
      savings: v.nullable(
        v.object(
          {
            baseline_model: v.string({ description: 'The model compared against' }),
            baseline_usd: v.number({
              description: 'An estimate of what the same tokens would have cost on it, in USD'
            }),
            spent_usd: v.number({
              description: 'What was billed, including the decision model, in USD'
            }),
            saved_usd: v.number({
              description:
                'baseline_usd minus spent_usd. Negative when the baseline is cheaper.'
            }),
            priced: v.boolean({
              description: 'Whether the baseline model has prices for every kind of token used'
            })
          },
          {
            description:
              'An estimate of what was saved compared with sending every request to one model. Null unless a baseline model was given.'
          }
        )
      )
    })
  )
  .build();
