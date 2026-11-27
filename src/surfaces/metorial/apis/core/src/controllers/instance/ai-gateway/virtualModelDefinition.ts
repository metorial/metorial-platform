import { v, type ValidationType, type ValidationTypeValue } from '@lowerdeck/validation';

let limits = {
  slugLength: 100,
  rules: 32,
  signals: 16,
  targetsPerRule: 8,
  expressionLength: 2000,
  instructionsLength: 2000,
  optionLength: 500,
  choiceOptions: 32,
  scoreLevels: 10,
  metadataEntries: 20,
  metadataKeyLength: 64,
  metadataValueLength: 256
};

let slugPattern = /^[a-z0-9][a-z0-9._-]*$/;
let ruleIdPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
let signalNamePattern = /^[a-z][a-z0-9_]*$/;

// v.record ignores modifiers, so entry counts and key formats are checked here.
let boundedRecord = <T>(
  items: ValidationType<T>,
  opts: {
    description: string;
    minEntries?: number;
    maxEntries: number;
    isValidKey?: (key: string) => boolean;
    invalidKeyMessage?: string;
  }
): ValidationType<Record<string, T>> => {
  let record = v.record(items, { description: opts.description });

  return {
    ...record,
    validate: value => {
      let result = record.validate(value);
      if (!result.success) return result;

      let keys = Object.keys(result.value);
      if (keys.length < (opts.minEntries ?? 0) || keys.length > opts.maxEntries) {
        return v.error([
          {
            code: 'invalid_size',
            message: `Expected between ${opts.minEntries ?? 0} and ${opts.maxEntries} entries`,
            received: keys.length,
            min: opts.minEntries ?? 0,
            max: opts.maxEntries
          }
        ]);
      }

      let isValidKey = opts.isValidKey;
      let invalidKey = isValidKey ? keys.find(key => !isValidKey(key)) : undefined;
      if (invalidKey !== undefined) {
        return v.error([
          {
            code: 'invalid_key',
            message: opts.invalidKeyMessage ?? 'Invalid key',
            received: invalidKey,
            path: [invalidKey]
          }
        ]);
      }

      return result;
    }
  };
};

export let virtualModelSlugValidator = v.string({
  description:
    'The model name to send in AI gateway requests to use the virtual model. Lowercase letters, digits, ".", "_" and "-", starting with a letter or digit.',
  examples: ['smart-router'],
  modifiers: [
    v.minLength(1),
    v.maxLength(limits.slugLength),
    v.regex(slugPattern, {
      message:
        'The slug must start with a letter or digit and contain only lowercase letters, digits, ".", "_" and "-".'
    })
  ]
});

export let virtualModelNameValidator = v.string({
  description: "The virtual model's name",
  modifiers: [v.minLength(1), v.maxLength(200)]
});

export let virtualModelDescriptionValidator = v.nullable(
  v.string({ description: 'What the virtual model is for', modifiers: [v.maxLength(2000)] })
);

let instructions = v.string({
  description: 'The question the decision model answers about each request',
  modifiers: [v.minLength(1), v.maxLength(limits.instructionsLength)]
});

let option = v.string({ modifiers: [v.maxLength(limits.optionLength)] });

let signalValidator = v.union([
  v.object({
    type: v.literal('boolean', {
      description: 'A yes or no question. Rules read signals.<name>.value and .probability.'
    }),
    instructions
  }),
  v.object({
    type: v.literal('choice', {
      description:
        'Picks one of several options. Rules read signals.<name>.choice, .probability, .confidence and .probabilities.'
    }),
    instructions,
    options: boundedRecord(option, {
      description:
        'The options to pick from, keyed by the value rules compare signals.<name>.choice against, each with a description of when to pick it',
      minEntries: 2,
      maxEntries: limits.choiceOptions
    })
  }),
  v.object({
    type: v.literal('score', {
      description:
        'Rates the request on a scale. Rules read signals.<name>.level (from 0), .score, .probability, .confidence and .probabilities.'
    }),
    instructions,
    levels: v.array(option, {
      description: 'What each level of the scale means, from lowest to highest',
      modifiers: [v.minLength(2), v.maxLength(limits.scoreLevels)]
    })
  })
]);

let overridesValidator = v.object(
  {
    reasoning_effort: v.optional(
      v.enumOf(['minimal', 'low', 'medium', 'high'], {
        description: 'The reasoning effort to request'
      })
    ),
    max_output_tokens: v.optional(
      v.number({
        description: 'The output token limit to request',
        modifiers: [v.integer(), v.minValue(1)]
      })
    ),
    temperature: v.optional(
      v.number({
        description: 'The temperature to request',
        modifiers: [v.minValue(0), v.maxValue(2)]
      })
    )
  },
  {
    description:
      "Request parameters to replace when these models are used. Omitted ones keep the request's values."
  }
);

let targetsValidator = v.array(
  v.object({
    model: v.string({
      description:
        'The model, by catalog slug or name, or pinned to a provider as <provider>:<vendor model id>. Cannot be another virtual model.',
      examples: ['anthropic/claude-sonnet-4'],
      modifiers: [v.minLength(1), v.maxLength(200)]
    }),
    weight: v.optional(
      v.number({
        description:
          'The relative share of requests this model receives among the listed models. Defaults to 1.',
        modifiers: [v.integer(), v.minValue(1), v.maxValue(1000)]
      })
    )
  }),
  {
    description:
      'The models to use, picked by weight. Models that cannot handle a request (images, tools, context size) are skipped and the rest serve as fallbacks.',
    modifiers: [v.minLength(1), v.maxLength(limits.targetsPerRule)]
  }
);

export let virtualModelDefinitionValidator = v.object(
  {
    decision: v.optional(
      v.object(
        {
          model: v.enumOf(['clef-flash', 'clef', 'jev'], {
            description: 'The decision model that answers the signals'
          }),
          connection_id: v.optional(
            v.string({
              description:
                "The ID of your own provider connection to run the decision model on. Omit to use Metorial's, billed per call."
            })
          ),
          timeout_ms: v.optional(
            v.number({
              description:
                'How long to wait for the decision model, in milliseconds. Defaults to 400.',
              modifiers: [v.integer(), v.minValue(50), v.maxValue(5000)]
            })
          ),
          on_error: v.optional(
            v.enumOf(['default', 'fail'], {
              description:
                'What happens when the decision model fails or times out: default (the default) skips the rules that read signals, fail rejects the request'
            })
          ),
          context: v.optional(
            v.object(
              {
                prior_turns: v.optional(
                  v.number({
                    description:
                      'How many earlier user turns the decision model sees. Defaults to 3.',
                    modifiers: [v.integer(), v.minValue(0), v.maxValue(10)]
                  })
                ),
                max_chars: v.optional(
                  v.number({
                    description:
                      'The most characters of conversation the decision model sees. Defaults to 8000.',
                    modifiers: [v.integer(), v.minValue(500), v.maxValue(32_000)]
                  })
                ),
                include_system: v.optional(
                  v.boolean({
                    description:
                      'Whether the decision model sees the system prompt. Defaults to true.'
                  })
                ),
                include_tool_names: v.optional(
                  v.boolean({
                    description:
                      'Whether the decision model sees the names of the tools in the request. Defaults to true.'
                  })
                )
              },
              { description: 'What the decision model sees of each request' }
            )
          )
        },
        { description: 'The decision model that answers the signals. Required with signals.' }
      )
    ),
    signals: v.optional(
      boundedRecord(signalValidator, {
        description:
          'Questions a decision model answers about each request, keyed by a name of lowercase letters, digits and underscores. Rules read the answers as signals.<name>. The decision model is only called once a rule that reads signals is reached.',
        maxEntries: limits.signals,
        isValidKey: name => signalNamePattern.test(name),
        invalidKeyMessage:
          'Signal names must start with a letter and contain only lowercase letters, digits and underscores.'
      })
    ),
    rules: v.array(
      v.object({
        id: v.string({
          description:
            'An identifier for the rule, in lowercase kebab-case, unique in the definition',
          examples: ['long-context'],
          modifiers: [
            v.maxLength(64),
            v.regex(ruleIdPattern, {
              message: 'Rule ids must be lowercase kebab-case, e.g. long-context.'
            })
          ]
        }),
        description: v.optional(
          v.string({ description: 'What the rule is for', modifiers: [v.maxLength(500)] })
        ),
        when: v.string({
          description:
            'A CEL expression that selects the rule when it evaluates to true. It can read request (e.g. request.input_tokens, request.has_images, request.tool_count, request.last_user_text), metadata (the x-metorial-metadata header), token (id, consumer_ref, which is the ID of the consumer the token was created for, and metadata), signals and now.',
          examples: ['request.has_images || request.input_tokens > 50000'],
          modifiers: [v.minLength(1), v.maxLength(limits.expressionLength)]
        }),
        models: targetsValidator,
        overrides: v.optional(overridesValidator)
      }),
      {
        description: 'Rules evaluated in order. The first one that matches picks the models.',
        modifiers: [v.maxLength(limits.rules)]
      }
    ),
    default: v.object(
      {
        models: targetsValidator,
        overrides: v.optional(overridesValidator)
      },
      { description: 'The models to use when no rule matches' }
    ),
    stickiness: v.optional(
      v.object(
        {
          metadata_key: v.string({
            description:
              'The request metadata entry that identifies a conversation, e.g. a session id',
            modifiers: [v.minLength(1), v.maxLength(64)]
          }),
          ttl_seconds: v.optional(
            v.number({
              description:
                'How long a conversation stays on its model, in seconds. Defaults to 3600.',
              modifiers: [v.integer(), v.minValue(60), v.maxValue(86_400)]
            })
          )
        },
        {
          description:
            'Keeps every request of a conversation on the model its first request was routed to, which preserves prompt caches'
        }
      )
    )
  },
  { description: 'How the virtual model picks a model for each request' }
);

export let virtualModelRequestMetadataValidator = boundedRecord(
  v.string({ modifiers: [v.maxLength(limits.metadataValueLength)] }),
  {
    description:
      'Request metadata as sent in the x-metorial-metadata header. Rules read it as metadata.',
    maxEntries: limits.metadataEntries,
    isValidKey: key => key.length > 0 && key.length <= limits.metadataKeyLength,
    invalidKeyMessage: `Metadata keys must be 1 to ${limits.metadataKeyLength} characters.`
  }
);

export let virtualModelDialectValidator = v.enumOf(
  ['openai_chat', 'anthropic_messages', 'open_responses'],
  {
    description:
      'The API format of the request: openai_chat (Chat Completions), anthropic_messages (Messages) or open_responses (Responses)'
  }
);

type DefinitionInput = ValidationTypeValue<typeof virtualModelDefinitionValidator>;
type SignalInput = ValidationTypeValue<typeof signalValidator>;
type TargetInput = DefinitionInput['default']['models'][number];
type OverridesInput = NonNullable<DefinitionInput['default']['overrides']>;

let toGatewaySignal = (signal: SignalInput) => {
  if (signal.type == 'choice') {
    return { type: signal.type, instructions: signal.instructions, options: signal.options };
  }

  if (signal.type == 'score') {
    return { type: signal.type, instructions: signal.instructions, levels: signal.levels };
  }

  return { type: signal.type, instructions: signal.instructions };
};

let toGatewayTargets = (targets: TargetInput[]) =>
  targets.map(target => ({ model: target.model, weight: target.weight }));

let toGatewayOverrides = (overrides: OverridesInput | undefined) =>
  overrides && {
    reasoningEffort: overrides.reasoning_effort,
    maxOutputTokens: overrides.max_output_tokens,
    temperature: overrides.temperature
  };

export let toGatewayVirtualModelDefinition = (definition: DefinitionInput) => ({
  decision: definition.decision && {
    model: definition.decision.model,
    connectionId: definition.decision.connection_id,
    timeoutMs: definition.decision.timeout_ms,
    onError: definition.decision.on_error,
    context: definition.decision.context && {
      priorTurns: definition.decision.context.prior_turns,
      maxChars: definition.decision.context.max_chars,
      includeSystem: definition.decision.context.include_system,
      includeToolNames: definition.decision.context.include_tool_names
    }
  },
  signals:
    definition.signals &&
    Object.fromEntries(
      Object.entries(definition.signals).map(([name, signal]) => [
        name,
        toGatewaySignal(signal)
      ])
    ),
  rules: definition.rules.map(rule => ({
    id: rule.id,
    description: rule.description,
    when: rule.when,
    models: toGatewayTargets(rule.models),
    overrides: toGatewayOverrides(rule.overrides)
  })),
  default: {
    models: toGatewayTargets(definition.default.models),
    overrides: toGatewayOverrides(definition.default.overrides)
  },
  stickiness: definition.stickiness && {
    metadataKey: definition.stickiness.metadata_key,
    ttlSeconds: definition.stickiness.ttl_seconds
  }
});
