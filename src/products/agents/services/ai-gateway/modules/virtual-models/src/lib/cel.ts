import { Environment, type ASTNode, type ParseResult } from '@marcbachmann/cel-js';
import { lastUserText, type RequestSummary } from '@mtsrc/ai-gateway-request-features';
import type {
  RequestMetadata,
  SignalValue,
  SignalValues,
  VirtualModelDefinition,
  VirtualModelRule
} from '@mtsrc/ai-gateway-spec';
import { invalidDefinition } from './definition';

let celLimits = {
  maxAstNodes: 400,
  maxDepth: 24,
  maxListElements: 64,
  maxMapEntries: 64,
  maxCallArguments: 8
};

let maxLastUserTextChars = 16_000;
let maxSystemTextChars = 8_000;

let signalTypeNames: Record<SignalValue['type'], string> = {
  boolean: 'BooleanSignal',
  choice: 'ChoiceSignal',
  score: 'ScoreSignal'
};

let unsupportedFunctions: Record<string, string> = {
  matches:
    'matches() is not supported. Use contains(), startsWith(), endsWith() or containsAny().'
};

let baseEnvironment = new Environment({ enableOptionalTypes: true, limits: celLimits })
  .registerType('Request', {
    fields: {
      dialect: 'string',
      stream: 'bool',
      input_tokens: 'int',
      input_chars: 'int',
      message_count: 'int',
      user_turns: 'int',
      is_continuation: 'bool',
      has_images: 'bool',
      has_files: 'bool',
      has_audio: 'bool',
      tool_count: 'int',
      tool_names: 'list<string>',
      tool_choice_required: 'bool',
      response_format: 'string',
      max_output_tokens: 'int',
      temperature: 'double',
      reasoning_effort: 'string',
      last_user_text: 'string',
      system_text: 'string'
    }
  })
  .registerType('Token', {
    fields: { id: 'string', consumer_ref: 'string', metadata: 'map<string, string>' }
  })
  .registerType(signalTypeNames.boolean, { fields: { value: 'bool', probability: 'double' } })
  .registerType(signalTypeNames.choice, {
    fields: {
      choice: 'string',
      probability: 'double',
      confidence: 'double',
      probabilities: 'map<string, double>'
    }
  })
  .registerType(signalTypeNames.score, {
    fields: {
      score: 'double',
      level: 'int',
      probability: 'double',
      confidence: 'double',
      probabilities: 'list<double>'
    }
  })
  .registerVariable('request', 'Request', {
    description:
      'The incoming request. max_output_tokens is 0 and temperature is -1.0 when the request leaves them unset.'
  })
  .registerVariable('metadata', 'map<string, string>', {
    description: 'Entries of the x-metorial-metadata header.'
  })
  .registerVariable('token', 'Token', { description: 'The gateway token making the request.' })
  .registerVariable('now', 'google.protobuf.Timestamp', { description: 'The current time.' })
  .registerFunction(
    'string.containsAny(list<string>): bool',
    (text: string, needles: string[]) => {
      let haystack = text.toLowerCase();
      return needles.some(needle => haystack.includes(needle.toLowerCase()));
    },
    {
      description:
        'Case-insensitive check whether the string contains any of the given substrings.'
    }
  );

let environmentFor = (definition: VirtualModelDefinition) =>
  baseEnvironment
    .clone()
    .registerType('Signals', {
      fields: Object.fromEntries(
        Object.entries(definition.signals ?? {}).map(([name, signal]) => [
          name,
          signalTypeNames[signal.type]
        ])
      )
    })
    .registerVariable('signals', 'Signals', {
      description:
        'Answers from the decision model, one per signal defined on the virtual model.'
    });

let childNodes = (node: ASTNode): ASTNode[] => {
  let collect = (value: unknown): ASTNode[] => {
    if (Array.isArray(value)) return value.flatMap(collect);
    if (value && typeof value == 'object' && 'op' in value) return [value as ASTNode];
    return [];
  };

  return node.op == 'value' || node.op == 'id' ? [] : collect(node.args);
};

let someNode = (node: ASTNode, predicate: (node: ASTNode) => boolean): boolean =>
  predicate(node) || childNodes(node).some(child => someNode(child, predicate));

let calledFunction = (node: ASTNode) =>
  node.op == 'call' || node.op == 'rcall' ? node.args[0] : undefined;

let errorSummary = (error: unknown) =>
  error && typeof error == 'object' && 'summary' in error && typeof error.summary == 'string'
    ? error.summary
    : error instanceof Error
      ? error.message
      : String(error);

export type CompiledRule = {
  rule: VirtualModelRule;
  program: ParseResult;
  usesSignals: boolean;
};

export type CompiledDefinition = {
  definition: VirtualModelDefinition;
  rules: CompiledRule[];
  usesSignals: boolean;
};

export let compileRule = (environment: Environment, rule: VirtualModelRule): CompiledRule => {
  let fail = (message: string) => invalidDefinition(`Rule "${rule.id}": ${message}`);

  let program: ParseResult;
  try {
    program = environment.parse(rule.when);
  } catch (error) {
    throw fail(errorSummary(error));
  }

  let unsupported = Object.keys(unsupportedFunctions).find(name =>
    someNode(program.ast, node => calledFunction(node) == name)
  );
  if (unsupported) throw fail(unsupportedFunctions[unsupported]!);

  let checked = program.check();
  if (!checked.valid) throw fail(errorSummary(checked.error));
  if (checked.type != 'bool') {
    throw fail(`the condition must evaluate to a bool, but evaluates to ${checked.type}.`);
  }

  return {
    rule,
    program,
    usesSignals: someNode(program.ast, node => node.op == 'id' && node.args == 'signals')
  };
};

export let compileDefinition = (definition: VirtualModelDefinition): CompiledDefinition => {
  let environment = environmentFor(definition);
  let rules = definition.rules.map(rule => compileRule(environment, rule));

  return { definition, rules, usesSignals: rules.some(rule => rule.usesSignals) };
};

let int = (value: number) => BigInt(Math.max(0, Math.trunc(value)));

let truncate = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

export let requestActivation = (summary: RequestSummary) => ({
  dialect: summary.dialect,
  stream: summary.stream,
  input_tokens: int(summary.estimatedInputTokens),
  input_chars: int(summary.inputChars),
  message_count: int(summary.messageCount),
  user_turns: int(summary.userTurns),
  is_continuation: summary.isContinuation,
  has_images: summary.hasImages,
  has_files: summary.hasFiles,
  has_audio: summary.hasAudio,
  tool_count: int(summary.toolCount),
  tool_names: summary.toolNames,
  tool_choice_required: summary.toolChoiceRequired,
  response_format: summary.responseFormat,
  max_output_tokens: int(summary.maxOutputTokens ?? 0),
  temperature: summary.temperature ?? -1,
  reasoning_effort: summary.reasoningEffort ?? '',
  last_user_text: truncate(lastUserText(summary), maxLastUserTextChars),
  system_text: truncate(summary.systemText, maxSystemTextChars)
});

export let signalsActivation = (signals: SignalValues) =>
  Object.fromEntries(
    Object.entries(signals).map(([name, signal]) => {
      if (signal.type == 'boolean') {
        return [name, { value: signal.value, probability: signal.probability }];
      }

      if (signal.type == 'choice') {
        return [
          name,
          {
            choice: signal.choice,
            probability: signal.probability,
            confidence: signal.confidence,
            probabilities: signal.probabilities
          }
        ];
      }

      return [
        name,
        {
          score: signal.score,
          level: BigInt(signal.level),
          probability: signal.probability,
          confidence: signal.confidence,
          probabilities: signal.probabilities
        }
      ];
    })
  );

export type RuleContext = {
  summary: RequestSummary;
  metadata: RequestMetadata;
  token: { id: string; consumerRef?: string | null; metadata?: Record<string, string> };
  now: Date;
};

export let ruleActivation = (context: RuleContext) => ({
  request: requestActivation(context.summary),
  metadata: context.metadata,
  token: {
    id: context.token.id,
    consumer_ref: context.token.consumerRef ?? '',
    metadata: context.token.metadata ?? {}
  },
  now: context.now
});

export type RuleTrace = {
  ruleId: string;
  outcome: 'matched' | 'not_matched' | 'error' | 'signals_unavailable';
  error?: string;
};

export type RuleEvaluation = {
  rule: VirtualModelRule | null;
  trace: RuleTrace[];
  signals: SignalValues | null;
  signalsRequested: boolean;
};

// Rules run in order and the first match wins. The decision model is only asked once a rule that
// reads `signals` is reached, so deterministic rules placed first can skip it entirely.
export let evaluateRules = async (d: {
  compiled: CompiledDefinition;
  context: RuleContext;
  resolveSignals: () => Promise<SignalValues | null>;
}): Promise<RuleEvaluation> => {
  let activation: Record<string, unknown> = { ...ruleActivation(d.context), signals: {} };
  let trace: RuleTrace[] = [];
  let signals: SignalValues | null = null;
  let signalsRequested = false;

  for (let compiled of d.compiled.rules) {
    let ruleId = compiled.rule.id;

    if (compiled.usesSignals && !signalsRequested) {
      signalsRequested = true;
      signals = await d.resolveSignals();
      if (signals) activation.signals = signalsActivation(signals);
    }

    if (compiled.usesSignals && !signals) {
      trace.push({ ruleId, outcome: 'signals_unavailable' });
      continue;
    }

    try {
      if ((await compiled.program(activation)) === true) {
        trace.push({ ruleId, outcome: 'matched' });
        return { rule: compiled.rule, trace, signals, signalsRequested };
      }

      trace.push({ ruleId, outcome: 'not_matched' });
    } catch (error) {
      trace.push({ ruleId, outcome: 'error', error: errorSummary(error) });
    }
  }

  return { rule: null, trace, signals, signalsRequested };
};
