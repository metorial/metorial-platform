import { summarizeRequest } from '@mtsrc/ai-gateway-request-features';
import type { SignalValues, VirtualModelDefinition } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it, vi } from 'vitest';
import { compileDefinition, evaluateRules, type RuleContext } from '../src/lib/cel';
import { parseDefinition } from '../src/lib/definition';

let definition = (
  overrides: Partial<VirtualModelDefinition> = {}
): VirtualModelDefinition => ({
  decision: { model: 'clef-flash' },
  signals: {
    complexity: {
      type: 'score',
      instructions: 'How hard is the request?',
      levels: ['Trivial', 'Moderate', 'Hard']
    },
    task: {
      type: 'choice',
      instructions: 'What kind of task?',
      options: { coding: 'Writing code', chat: 'Small talk' }
    },
    sensitive: { type: 'boolean', instructions: 'Does it contain personal data?' }
  },
  rules: [
    { id: 'vision', when: 'request.has_images', models: [{ model: 'openai/gpt-5' }] },
    {
      id: 'hard-code',
      when: 'signals.task.choice == "coding" && signals.complexity.level >= 2',
      models: [{ model: 'anthropic/claude-opus-5' }]
    },
    {
      id: 'easy',
      when: 'signals.complexity.level == 0 && signals.complexity.probability > 0.6',
      models: [{ model: 'openai/gpt-5-nano' }]
    }
  ],
  default: { models: [{ model: 'anthropic/claude-sonnet-5' }] },
  ...overrides
});

let signals: SignalValues = {
  complexity: {
    type: 'score',
    score: 1.9,
    level: 2,
    probability: 0.8,
    confidence: 0.6,
    probabilities: [0.1, 0.1, 0.8]
  },
  task: {
    type: 'choice',
    choice: 'coding',
    probability: 0.9,
    confidence: 0.7,
    probabilities: { coding: 0.9, chat: 0.1 }
  },
  sensitive: { type: 'boolean', value: false, probability: 0.1 }
};

let context = (body: unknown, metadata: Record<string, string> = {}): RuleContext => ({
  summary: summarizeRequest('openai_chat', body),
  metadata,
  token: { id: 'agtk_1', consumerRef: 'user-7' },
  now: new Date('2026-11-20T10:00:00Z')
});

let textRequest = { messages: [{ role: 'user', content: 'Refactor the scheduler' }] };

let imageRequest = {
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is this?' },
        { type: 'image_url', image_url: { url: 'https://x/y.png' } }
      ]
    }
  ]
};

describe('compileDefinition', () => {
  it('marks only rules that read signals', () => {
    let compiled = compileDefinition(definition());

    expect(compiled.rules.map(rule => rule.usesSignals)).toEqual([false, true, true]);
    expect(compiled.usesSignals).toBe(true);
  });

  let compileWhen = (when: string) => () =>
    compileDefinition(definition({ rules: [{ id: 'r', when, models: [{ model: 'x' }] }] }));

  it('rejects syntax and type errors with the rule id', () => {
    expect(compileWhen('request.has_images &&')).toThrow(/Rule "r"/);
    expect(compileWhen('request.input_tokens')).toThrow(/must evaluate to a bool/);
    expect(compileWhen('request.nope')).toThrow(/Rule "r"/);
    expect(compileWhen('signals.unknown.value')).toThrow(/Rule "r"/);
  });

  it('rejects regular expressions', () => {
    expect(compileWhen('request.last_user_text.matches("(a+)+$")')).toThrow(/matches\(\)/);
  });

  it('supports the documented helpers', () => {
    for (let when of [
      'request.last_user_text.containsAny(["sql", "postgres"])',
      'request.input_tokens > 1000 && request.temperature < 0.5',
      '"tier" in metadata && metadata["tier"] == "free"',
      'metadata.?tier.orValue("") == "free"',
      'token.consumer_ref.startsWith("user-")',
      'now.getHours() >= 9',
      'request.tool_names.exists(t, t == "bash")'
    ]) {
      expect(compileWhen(when), when).not.toThrow();
    }
  });
});

describe('evaluateRules', () => {
  it('matches deterministic rules without calling the decision model', async () => {
    let resolveSignals = vi.fn(async () => signals);

    let result = await evaluateRules({
      compiled: compileDefinition(definition()),
      context: context(imageRequest),
      resolveSignals
    });

    expect(result.rule?.id).toBe('vision');
    expect(resolveSignals).not.toHaveBeenCalled();
    expect(result.signalsRequested).toBe(false);
  });

  it('asks the decision model once and routes on its answers', async () => {
    let resolveSignals = vi.fn(async () => signals);

    let result = await evaluateRules({
      compiled: compileDefinition(definition()),
      context: context(textRequest),
      resolveSignals
    });

    expect(result.rule?.id).toBe('hard-code');
    expect(resolveSignals).toHaveBeenCalledTimes(1);
    expect(result.trace.map(entry => entry.outcome)).toEqual(['not_matched', 'matched']);
  });

  it('falls through to the default when the decision model is unavailable', async () => {
    let result = await evaluateRules({
      compiled: compileDefinition(definition()),
      context: context(textRequest),
      resolveSignals: async () => null
    });

    expect(result.rule).toBeNull();
    expect(result.trace.map(entry => entry.outcome)).toEqual([
      'not_matched',
      'signals_unavailable',
      'signals_unavailable'
    ]);
  });

  it('treats evaluation errors as no match', async () => {
    let compiled = compileDefinition(
      definition({
        rules: [
          { id: 'missing-key', when: 'metadata["tier"] == "free"', models: [{ model: 'a' }] },
          { id: 'present', when: 'metadata["team"] == "core"', models: [{ model: 'b' }] }
        ]
      })
    );

    let result = await evaluateRules({
      compiled,
      context: context(textRequest, { team: 'core' }),
      resolveSignals: async () => signals
    });

    expect(result.rule?.id).toBe('present');
    expect(result.trace[0]!.outcome).toBe('error');
  });

  it('exposes request fields with CEL types', async () => {
    let compiled = compileDefinition(
      definition({
        rules: [
          {
            id: 'all',
            when: [
              'request.dialect == "openai_chat"',
              'request.input_tokens < 100',
              'request.message_count == 1',
              'request.max_output_tokens == 0',
              'request.temperature == -1.0',
              'request.last_user_text.containsAny(["SCHEDULER"])',
              'token.consumer_ref == "user-7"',
              'now.getHours("UTC") == 10'
            ].join(' && '),
            models: [{ model: 'a' }]
          }
        ]
      })
    );

    let result = await evaluateRules({
      compiled,
      context: context(textRequest),
      resolveSignals: async () => signals
    });

    expect(result.trace).toEqual([{ ruleId: 'all', outcome: 'matched' }]);
  });
});

describe('parseDefinition', () => {
  it('accepts a valid definition', () => {
    expect(parseDefinition(definition()).rules).toHaveLength(3);
  });

  it('rejects duplicate rule ids, signals without a decision model and bad names', () => {
    let base = definition();

    expect(() =>
      parseDefinition({ ...base, rules: [base.rules[0], { ...base.rules[1], id: 'vision' }] })
    ).toThrow(/used more than once/);
    expect(() => parseDefinition({ ...base, decision: undefined })).toThrow(/decision model/);
    expect(() =>
      parseDefinition({
        ...base,
        signals: { Complexity: { type: 'boolean', instructions: 'x' } }
      })
    ).toThrow(/Signal "Complexity"/);
    expect(() => parseDefinition({ ...base, default: { models: [] } })).toThrow(/default/);
  });
});
