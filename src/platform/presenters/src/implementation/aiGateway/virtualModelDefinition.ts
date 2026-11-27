import { v } from '@lowerdeck/validation';
import type { AiGatewayVirtualModelVersion } from '@metorial/module-ai-gateway';

type Definition = AiGatewayVirtualModelVersion['definition'];
type Decision = NonNullable<Definition['decision']>;
type Signal = NonNullable<Definition['signals']>[string];
type Rule = Definition['rules'][number];
type Target = Rule['models'][number];
type Stickiness = NonNullable<Definition['stickiness']>;

export type AiGatewayParameterOverrides = NonNullable<Rule['overrides']>;

let presentDecision = (decision: Decision) => ({
  model: decision.model,
  connection_id: decision.connectionId ?? null,
  timeout_ms: decision.timeoutMs ?? null,
  on_error: decision.onError ?? null,
  context: decision.context
    ? {
        prior_turns: decision.context.priorTurns ?? null,
        max_chars: decision.context.maxChars ?? null,
        include_system: decision.context.includeSystem ?? null,
        include_tool_names: decision.context.includeToolNames ?? null
      }
    : null
});

let presentSignal = (signal: Signal) => {
  if (signal.type == 'choice') {
    return { type: signal.type, instructions: signal.instructions, options: signal.options };
  }

  if (signal.type == 'score') {
    return { type: signal.type, instructions: signal.instructions, levels: signal.levels };
  }

  return { type: signal.type, instructions: signal.instructions };
};

let presentTargets = (targets: Target[]) =>
  targets.map(target => ({ model: target.model, weight: target.weight ?? null }));

export let presentAiGatewayParameterOverrides = (
  overrides: AiGatewayParameterOverrides | null | undefined
) =>
  overrides
    ? {
        reasoning_effort: overrides.reasoningEffort ?? null,
        max_output_tokens: overrides.maxOutputTokens ?? null,
        temperature: overrides.temperature ?? null
      }
    : null;

let presentStickiness = (stickiness: Stickiness) => ({
  metadata_key: stickiness.metadataKey,
  ttl_seconds: stickiness.ttlSeconds ?? null
});

export let presentAiGatewayVirtualModelDefinition = (definition: Definition) => ({
  decision: definition.decision ? presentDecision(definition.decision) : null,
  signals: definition.signals
    ? Object.fromEntries(
        Object.entries(definition.signals).map(([name, signal]) => [
          name,
          presentSignal(signal)
        ])
      )
    : null,
  rules: definition.rules.map(rule => ({
    id: rule.id,
    description: rule.description ?? null,
    when: rule.when,
    models: presentTargets(rule.models),
    overrides: presentAiGatewayParameterOverrides(rule.overrides)
  })),
  default: {
    models: presentTargets(definition.default.models),
    overrides: presentAiGatewayParameterOverrides(definition.default.overrides)
  },
  stickiness: definition.stickiness ? presentStickiness(definition.stickiness) : null
});

let instructions = v.string({
  description: 'The question the decision model answers about each request'
});

export let aiGatewayParameterOverridesSchema = v.nullable(
  v.object(
    {
      reasoning_effort: v.nullable(
        v.enumOf(['minimal', 'low', 'medium', 'high'], {
          description: 'The reasoning effort to request. Null keeps what the request asks for.'
        })
      ),
      max_output_tokens: v.nullable(
        v.number({
          description:
            'The output token limit to request. Null keeps what the request asks for.'
        })
      ),
      temperature: v.nullable(
        v.number({
          description: 'The temperature to request. Null keeps what the request asks for.'
        })
      )
    },
    { description: 'Request parameters replaced when these models are used' }
  )
);

let targetsSchema = v.array(
  v.object({
    model: v.string({
      description:
        'The model, by catalog slug or name, or pinned to a provider as <provider>:<vendor model id>',
      examples: ['anthropic/claude-sonnet-4']
    }),
    weight: v.nullable(
      v.number({
        description:
          'The relative share of requests this model receives among the listed models. Null counts as 1.'
      })
    )
  }),
  {
    description:
      'The models to use, picked by weight. Models that cannot handle a request (images, tools, context size) are skipped and the rest serve as fallbacks.'
  }
);

export let aiGatewayVirtualModelDefinitionSchema = v.object(
  {
    decision: v.nullable(
      v.object(
        {
          model: v.enumOf(['clef-flash', 'clef', 'jev'], {
            description: 'The decision model that answers the signals'
          }),
          connection_id: v.nullable(
            v.string({
              description:
                "The ID of your own provider connection the decision model runs on. Null uses Metorial's, billed per call."
            })
          ),
          timeout_ms: v.nullable(
            v.number({
              description:
                'How long to wait for the decision model, in milliseconds. Null uses 400.'
            })
          ),
          on_error: v.nullable(
            v.enumOf(['default', 'fail'], {
              description:
                'What happens when the decision model fails or times out: default skips the rules that read signals, fail rejects the request. Null means default.'
            })
          ),
          context: v.nullable(
            v.object(
              {
                prior_turns: v.nullable(
                  v.number({
                    description:
                      'How many earlier user turns the decision model sees. Null uses 3.'
                  })
                ),
                max_chars: v.nullable(
                  v.number({
                    description:
                      'The most characters of conversation the decision model sees. Null uses 8000.'
                  })
                ),
                include_system: v.nullable(
                  v.boolean({
                    description:
                      'Whether the decision model sees the system prompt. Null means true.'
                  })
                ),
                include_tool_names: v.nullable(
                  v.boolean({
                    description:
                      'Whether the decision model sees the names of the tools in the request. Null means true.'
                  })
                )
              },
              { description: 'What the decision model sees of each request' }
            )
          )
        },
        {
          description:
            'The decision model that answers the signals. Null when the virtual model has no signals.'
        }
      )
    ),
    signals: v.nullable(
      v.record(
        v.union([
          v.object({
            type: v.literal('boolean', { description: 'A yes or no question' }),
            instructions
          }),
          v.object({
            type: v.literal('choice', { description: 'Picks one of several options' }),
            instructions,
            options: v.record(v.string({ description: 'When to pick the option' }), {
              description: 'The options to pick from, keyed by the value rules compare against'
            })
          }),
          v.object({
            type: v.literal('score', { description: 'Rates the request on a scale' }),
            instructions,
            levels: v.array(v.string({ description: 'What the level means' }), {
              description: 'The levels of the scale, from lowest (level 0) to highest'
            })
          })
        ]),
        {
          description:
            'Questions a decision model answers about each request, keyed by name. Rules read the answers as signals.<name>. Null when there are none.'
        }
      )
    ),
    rules: v.array(
      v.object({
        id: v.string({ description: "The rule's identifier, unique within the definition" }),
        description: v.nullable(v.string({ description: 'What the rule is for' })),
        when: v.string({
          description:
            'A CEL expression that selects the rule when it evaluates to true. It can read request, metadata, token, signals and now.',
          examples: ['request.has_images || request.input_tokens > 50000']
        }),
        models: targetsSchema,
        overrides: aiGatewayParameterOverridesSchema
      }),
      { description: 'Rules evaluated in order. The first one that matches picks the models.' }
    ),
    default: v.object(
      {
        models: targetsSchema,
        overrides: aiGatewayParameterOverridesSchema
      },
      { description: 'The models used when no rule matches' }
    ),
    stickiness: v.nullable(
      v.object(
        {
          metadata_key: v.string({
            description:
              'The request metadata entry that identifies a conversation, e.g. a session id'
          }),
          ttl_seconds: v.nullable(
            v.number({
              description:
                'How long a conversation stays on its model, in seconds. Null uses 3600.'
            })
          )
        },
        {
          description:
            'Keeps every request of a conversation on the model its first request was routed to, which preserves prompt caches. Null when disabled.'
        }
      )
    )
  },
  { description: 'How the virtual model picks a model for each request' }
);
