import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { decisionModelSlugs } from './decision';

export let virtualModelLimits = {
  slugLength: 100,
  rules: 32,
  signals: 16,
  targetsPerRule: 8,
  expressionLength: 2000,
  instructionsLength: 2000,
  optionLength: 500,
  choiceOptions: 32,
  scoreLevels: 10
};

export let virtualModelSlugPattern = /^[a-z0-9][a-z0-9._-]*$/;

export let virtualModelRuleIdPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export let virtualModelSignalNamePattern = /^[a-z][a-z0-9_]*$/;

export let reasoningEfforts = ['minimal', 'low', 'medium', 'high'] as const;

let instructions = v.string({
  modifiers: [v.minLength(1), v.maxLength(virtualModelLimits.instructionsLength)]
});

let option = v.string({ modifiers: [v.maxLength(virtualModelLimits.optionLength)] });

export let booleanSignalSchema = v.object({
  type: v.literal('boolean'),
  instructions
});

export let choiceSignalSchema = v.object({
  type: v.literal('choice'),
  instructions,
  options: v.record(option)
});

export let scoreSignalSchema = v.object({
  type: v.literal('score'),
  instructions,
  levels: v.array(option, {
    modifiers: [v.minLength(2), v.maxLength(virtualModelLimits.scoreLevels)]
  })
});

export let virtualModelSignalSchema = v.union([
  booleanSignalSchema,
  choiceSignalSchema,
  scoreSignalSchema
]);

export let parameterOverridesSchema = v.object({
  reasoningEffort: v.optional(v.enumOf(reasoningEfforts)),
  maxOutputTokens: v.optional(v.number({ modifiers: [v.integer(), v.minValue(1)] })),
  temperature: v.optional(v.number({ modifiers: [v.minValue(0), v.maxValue(2)] }))
});

export let virtualModelTargetSchema = v.object({
  model: v.string({ modifiers: [v.minLength(1), v.maxLength(200)] }),
  weight: v.optional(v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(1000)] }))
});

let targets = v.array(virtualModelTargetSchema, {
  modifiers: [v.minLength(1), v.maxLength(virtualModelLimits.targetsPerRule)]
});

export let virtualModelRuleSchema = v.object({
  id: v.string({ modifiers: [v.regex(virtualModelRuleIdPattern), v.maxLength(64)] }),
  description: v.optional(v.string({ modifiers: [v.maxLength(500)] })),
  when: v.string({
    modifiers: [v.minLength(1), v.maxLength(virtualModelLimits.expressionLength)]
  }),
  models: targets,
  overrides: v.optional(parameterOverridesSchema)
});

export let virtualModelDefaultSchema = v.object({
  models: targets,
  overrides: v.optional(parameterOverridesSchema)
});

export let decisionConfigSchema = v.object({
  model: v.enumOf(decisionModelSlugs),
  connectionId: v.optional(v.string()),
  timeoutMs: v.optional(
    v.number({ modifiers: [v.integer(), v.minValue(50), v.maxValue(5000)] })
  ),
  onError: v.optional(v.enumOf(['default', 'fail'])),
  context: v.optional(
    v.object({
      priorTurns: v.optional(
        v.number({ modifiers: [v.integer(), v.minValue(0), v.maxValue(10)] })
      ),
      maxChars: v.optional(
        v.number({ modifiers: [v.integer(), v.minValue(500), v.maxValue(32_000)] })
      ),
      includeSystem: v.optional(v.boolean()),
      includeToolNames: v.optional(v.boolean())
    })
  )
});

export let stickinessSchema = v.object({
  metadataKey: v.string({ modifiers: [v.minLength(1), v.maxLength(64)] }),
  ttlSeconds: v.optional(
    v.number({ modifiers: [v.integer(), v.minValue(60), v.maxValue(86_400)] })
  )
});

export let virtualModelDefinitionSchema = v.object({
  decision: v.optional(decisionConfigSchema),
  signals: v.optional(v.record(virtualModelSignalSchema)),
  rules: v.array(virtualModelRuleSchema, {
    modifiers: [v.maxLength(virtualModelLimits.rules)]
  }),
  default: virtualModelDefaultSchema,
  stickiness: v.optional(stickinessSchema)
});

export type VirtualModelDefinition = ValidationTypeValue<typeof virtualModelDefinitionSchema>;

export type VirtualModelSignal = ValidationTypeValue<typeof virtualModelSignalSchema>;

export type VirtualModelRule = ValidationTypeValue<typeof virtualModelRuleSchema>;

export type VirtualModelTarget = ValidationTypeValue<typeof virtualModelTargetSchema>;

export type DecisionConfig = ValidationTypeValue<typeof decisionConfigSchema>;

export type ParameterOverrides = ValidationTypeValue<typeof parameterOverridesSchema>;

export type SignalValue =
  | { type: 'boolean'; value: boolean; probability: number }
  | {
      type: 'choice';
      choice: string;
      probability: number;
      confidence: number;
      probabilities: Record<string, number>;
    }
  | {
      type: 'score';
      score: number;
      level: number;
      probability: number;
      confidence: number;
      probabilities: number[];
    };

export type SignalValues = Record<string, SignalValue>;
