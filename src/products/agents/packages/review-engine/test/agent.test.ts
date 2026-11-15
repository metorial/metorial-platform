import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { jsonSchema, tool } from 'ai';
import {
  createMemoryRateLimiter,
  createRunState,
  runReviewAgent,
  type ReviewModel
} from '../src';

let mockModel = () =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'done' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 100, text: 100, reasoning: 0 }
      },
      warnings: []
    })
  });

let pricing = (price: number) => ({
  inputPerMillion: price,
  outputPerMillion: price,
  cacheReadPerMillion: price,
  cacheWritePerMillion: 0
});

let run = (model: ReviewModel, limiter = createMemoryRateLimiter()) =>
  runReviewAgent({
    model,
    modelAccess: { limiter, maxWaitMs: 1000 },
    system: 'system',
    prompt: 'prompt',
    tools: {},
    state: createRunState(),
    maxSteps: 5,
    maxCostMicros: 1_000_000,
    maxFixRounds: 1
  });

describe('review agent model fallback', () => {
  it('uses the primary model while its rate limit has a free slot', async () => {
    let primary = mockModel();
    let fallback = mockModel();

    let result = await run({
      slug: 'primary',
      model: primary,
      pricing: pricing(10),
      requestsPerMinute: 18,
      fallback: { slug: 'fallback', model: fallback, pricing: pricing(1) }
    });

    expect(primary.doGenerateCalls).toHaveLength(1);
    expect(fallback.doGenerateCalls).toHaveLength(0);
    expect(result.modelSteps).toEqual({ primary: 1 });
    expect(result.usage.costMicros).toBe(11_000);
  });

  it('switches to the fallback and prices the step with its pricing', async () => {
    let primary = mockModel();
    let fallback = mockModel();
    let limiter = createMemoryRateLimiter();

    await limiter.reserve({ key: 'primary', intervalMs: 3000, maxWaitMs: 0 });
    await limiter.reserve({ key: 'primary', intervalMs: 3000, maxWaitMs: 10_000 });

    let result = await run(
      {
        slug: 'primary',
        model: primary,
        pricing: pricing(10),
        requestsPerMinute: 18,
        fallback: { slug: 'fallback', model: fallback, pricing: pricing(1) }
      },
      limiter
    );

    expect(primary.doGenerateCalls).toHaveLength(0);
    expect(fallback.doGenerateCalls).toHaveLength(1);
    expect(result.modelSteps).toEqual({ fallback: 1 });
    expect(result.usage.costMicros).toBe(1_100);
  });
});

describe('review agent compaction', () => {
  it('stubs old tool output once the context window is nearly full', async () => {
    let call = 0;
    let model = new MockLanguageModelV4({
      doGenerate: async () => {
        call++;

        return {
          content:
            call <= 10
              ? [
                  {
                    type: 'tool-call' as const,
                    toolCallId: `call-${call}`,
                    toolName: 'read',
                    input: '{}'
                  }
                ]
              : [{ type: 'text' as const, text: 'done' }],
          finishReason:
            call <= 10
              ? { unified: 'tool-calls', raw: 'tool_calls' }
              : { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 90_000, noCache: 90_000, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 10, text: 10, reasoning: 0 }
          },
          warnings: []
        };
      }
    });

    let result = await runReviewAgent({
      model: { slug: 'm', model, pricing: pricing(0), contextWindow: 128_000 },
      system: 'system',
      prompt: 'prompt',
      tools: {
        read: tool({
          description: 'Reads a file',
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          execute: async () => 'y'.repeat(5000)
        })
      },
      state: createRunState(),
      maxSteps: 20,
      maxCostMicros: 1_000_000,
      maxFixRounds: 1
    });

    let lastPrompt = JSON.stringify(model.doGenerateCalls.at(-1)?.prompt);

    expect(result.compactions).toBeGreaterThan(0);
    expect(lastPrompt).toContain('Output omitted to save context');
    expect(lastPrompt.length).toBeLessThan(10 * 5000);
  });
});
