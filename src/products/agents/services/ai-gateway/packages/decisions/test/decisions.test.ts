import { summarizeRequest } from '@mtsrc/ai-gateway-request-features';
import type { VirtualModelSignal } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it } from 'vitest';
import {
  buildDecisionState,
  decisionCostUsd,
  decisionStateHash,
  DecisionError,
  runDecision,
  toQuestions
} from '../src';

let signals: Record<string, VirtualModelSignal> = {
  complexity: {
    type: 'score',
    instructions: 'How hard is it?',
    levels: ['Trivial', 'Simple', 'Hard']
  },
  task: {
    type: 'choice',
    instructions: 'What kind of work?',
    options: { coding: 'Code', writing: 'Prose' }
  },
  sensitive: { type: 'boolean', instructions: 'Does it contain personal data?' }
};

let answers = {
  complexity: {
    type: 'score',
    score: 1.7,
    confidence: 0.55,
    probabilities: { '0': 0.1, '1': 0.1, '2': 0.8 }
  },
  task: {
    type: 'choice',
    choice: 'coding',
    confidence: 0.6,
    probabilities: { coding: 0.9, writing: 0.1 }
  },
  sensitive: { type: 'noul', noul: 0.2 }
};

let state = { request: 'Fix the race condition' };

let recordingFetch = (response: unknown, status = 200) => {
  let calls: { url: string; init: RequestInit }[] = [];

  let fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(response), { status });
  }) as unknown as typeof fetch;

  return { calls, fetch: fetchFn };
};

describe('toQuestions', () => {
  it('maps signals onto System One question types', () => {
    expect(toQuestions(signals)).toEqual({
      complexity: {
        type: 'score',
        instructions: 'How hard is it?',
        criteria: ['Trivial', 'Simple', 'Hard']
      },
      task: {
        type: 'choice',
        instructions: 'What kind of work?',
        criteria: { coding: 'Code', writing: 'Prose' }
      },
      sensitive: { type: 'noul', instructions: 'Does it contain personal data?' }
    });
  });
});

describe('runDecision', () => {
  it('calls Workers AI for Clef and unwraps its envelope', async () => {
    let recorded = recordingFetch({
      success: true,
      result: { model: 'clef-flash', answers, usage: { input_tokens: 1000, output_tokens: 3 } }
    });

    let result = await runDecision({
      model: 'clef-flash',
      credentials: { apiToken: 'cf-token' },
      config: { accountId: 'acc' },
      signals,
      state,
      fetch: recorded.fetch
    });

    expect(recorded.calls[0]!.url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/cloudflare/clef-flash'
    );
    expect((recorded.calls[0]!.init.headers as Record<string, string>).authorization).toBe(
      'Bearer cf-token'
    );
    expect(JSON.parse(recorded.calls[0]!.init.body as string)).toMatchObject({
      model: 'clef-flash',
      state
    });

    expect(result.signals).toEqual({
      complexity: {
        type: 'score',
        score: 1.7,
        level: 2,
        probability: 0.8,
        confidence: 0.55,
        probabilities: [0.1, 0.1, 0.8]
      },
      task: {
        type: 'choice',
        choice: 'coding',
        probability: 0.9,
        confidence: 0.6,
        probabilities: { coding: 0.9, writing: 0.1 }
      },
      sensitive: { type: 'boolean', value: false, probability: 0.2 }
    });
    expect(result.inputTokens).toBe(1000);
    expect(result.costUsd).toBeCloseTo(decisionCostUsd('clef-flash', 1000));
  });

  it('calls TypeSafe with the pinned Jev version', async () => {
    let recorded = recordingFetch({
      model: 'jev-1.14.0',
      answers,
      usage: { input_tokens: 10, output_tokens: 1 }
    });

    let result = await runDecision({
      model: 'jev',
      credentials: { apiKey: 'ts-key' },
      config: {},
      signals,
      state,
      fetch: recorded.fetch
    });

    expect(recorded.calls[0]!.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(JSON.parse(recorded.calls[0]!.init.body as string).model).toBe('jev-1.14.0');
    expect(result.model).toBe('jev-1.14.0');
  });

  it('rejects answers outside the defined options', async () => {
    let recorded = recordingFetch({
      answers: { ...answers, task: { ...answers.task, choice: 'cooking' } },
      usage: { input_tokens: 1, output_tokens: 1 }
    });

    await expect(
      runDecision({
        model: 'jev',
        credentials: { apiKey: 'k' },
        config: {},
        signals,
        state,
        fetch: recorded.fetch
      })
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('classifies HTTP failures', async () => {
    let limited = recordingFetch({ detail: 'slow down' }, 429);
    let rejected = recordingFetch({ detail: 'bad key' }, 401);

    let run = (fetchFn: typeof fetch) =>
      runDecision({
        model: 'jev',
        credentials: { apiKey: 'k' },
        config: {},
        signals,
        state,
        fetch: fetchFn
      });

    await expect(run(limited.fetch)).rejects.toMatchObject({
      code: 'rate_limited',
      httpStatus: 429
    });
    await expect(run(rejected.fetch)).rejects.toMatchObject({
      code: 'rejected',
      message: 'bad key'
    });
  });

  it('times out slow backends', async () => {
    let slowFetch = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
      })) as unknown as typeof fetch;

    let error = await runDecision({
      model: 'jev',
      credentials: { apiKey: 'k' },
      config: {},
      signals,
      state,
      timeoutMs: 20,
      fetch: slowFetch
    }).catch(error => error);

    expect(error).toBeInstanceOf(DecisionError);
    expect(error.code).toBe('timeout');
  });

  it('needs the Cloudflare account id', async () => {
    await expect(
      runDecision({
        model: 'clef',
        credentials: { apiToken: 't' },
        config: {},
        signals,
        state
      })
    ).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('buildDecisionState', () => {
  let agentStep = (toolOutput: string) =>
    summarizeRequest('anthropic_messages', {
      system: 'You are a coding agent.',
      tools: [{ name: 'bash' }],
      messages: [
        { role: 'user', content: 'Set up the repo' },
        { role: 'assistant', content: 'Done.' },
        { role: 'user', content: 'Now fix the failing test' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't', name: 'bash', input: {} }]
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't', content: toolOutput }]
        }
      ]
    });

  it('keeps human turns, the system prompt and tool names', () => {
    expect(buildDecisionState(agentStep('1 failed'))).toEqual({
      request: 'Now fix the failing test',
      system: 'You are a coding agent.',
      conversation: ['Set up the repo'],
      tools: ['bash']
    });
  });

  it('produces the same hash across agent loop steps', () => {
    expect(decisionStateHash(buildDecisionState(agentStep('1 failed')))).toBe(
      decisionStateHash(buildDecisionState(agentStep('0 failed')))
    );
  });

  it('respects the context options and budget', () => {
    let summary = summarizeRequest('openai_chat', {
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'a'.repeat(5000) },
        { role: 'user', content: 'b'.repeat(5000) }
      ]
    });

    let built = buildDecisionState(summary, { maxChars: 1000, includeSystem: false });

    expect(built.system).toBeUndefined();
    expect(built.request).toHaveLength(500);
    expect(built.request.endsWith('…')).toBe(true);
    expect(built.conversation![0]!.length).toBeLessThanOrEqual(500);

    expect(buildDecisionState(summary, { priorTurns: 0 }).conversation).toBeUndefined();
  });
});
