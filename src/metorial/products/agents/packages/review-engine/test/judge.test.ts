import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runConsistencyJudge } from '../src/judge';
import type { ReviewModel } from '../src/model';

vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn(async (_ms, _value, options) => options?.signal?.throwIfAborted())
}));

let pricing = {
  inputPerMillion: 1,
  outputPerMillion: 1,
  cacheReadPerMillion: 1,
  cacheWritePerMillion: 0
};

let response = (verdict: unknown = { consistent: true, issues: [] }) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(verdict) }],
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage: {
    inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 100, text: 100, reasoning: 0 }
  },
  warnings: []
});

let run = (
  model: ReviewModel['model'],
  options: Partial<Parameters<typeof runConsistencyJudge>[0]> = {}
) =>
  runConsistencyJudge({
    model: { slug: 'judge', model, pricing },
    report: { summary: { text: 'A report' } },
    scores: { security: 93 },
    ...options
  });

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('consistency judge', () => {
  it('returns the verdict and model usage', async () => {
    let model = new MockLanguageModelV4({ doGenerate: response() });
    let result = await run(model);

    expect(result.verdict).toEqual({ consistent: true, issues: [] });
    expect(result.usage.costMicros).toBe(1100);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it.each([
    { consistent: false, issues: [{ section: 'scores' }, { section: 'scores' }] },
    { consistent: false, issues: [{ section: 'summary' }] },
    { consistent: false, issues: [{ section: 'summary', message: '   ' }] },
    { consistent: false, issues: [{ section: 'summary', message: 'undefined' }] },
    { consistent: false, issues: [] },
    { consistent: true, issues: [{ section: 'summary', message: 'Contradiction' }] },
    { consistent: false, issues: [{ section: 'scores', message: 'Change score' }] }
  ])('repairs a malformed verdict without forwarding invalid issues: %j', async verdict => {
    let onUsage = vi.fn();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doGenerate: async () => response(++calls == 1 ? verdict : undefined)
    });

    let result = await run(model, {
      onUsage,
      reviewInstructions: 'Static review of intended behavior.'
    });

    expect(result.verdict).toEqual({ consistent: true, issues: [] });
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(result.usage.costMicros).toBe(2200);
    expect(onUsage).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(model.doGenerateCalls[1]!.prompt)).toContain(
      'previous response did not satisfy'
    );
    expect(JSON.stringify(model.doGenerateCalls[0]!.prompt)).toContain(
      'Static review of intended behavior.'
    );
  });

  it('does not accept an endlessly malformed response as report feedback', async () => {
    let onUsage = vi.fn();
    let model = new MockLanguageModelV4({
      doGenerate: response({ consistent: false, issues: [{ section: 'scores' }] })
    });

    await expect(run(model, { onUsage })).rejects.toThrow('Verdict must contain');
    expect(model.doGenerateCalls).toHaveLength(3);
    expect(onUsage).toHaveBeenCalledTimes(3);
  });

  it('returns concrete corrections for editable sections', async () => {
    let verdict = {
      consistent: false,
      issues: [
        {
          section: 'summary',
          message: 'The finding describes deletion; acknowledge it in the summary.'
        }
      ]
    };
    let model = new MockLanguageModelV4({ doGenerate: response(verdict) });

    expect((await run(model)).verdict).toEqual(verdict);
  });

  it('retries a timed-out request with a fresh signal and another rate-limit slot', async () => {
    let reserve = vi.fn(async () => 0);
    let onLog = vi.fn();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doGenerate: async () => {
        if (++calls == 1) {
          throw new DOMException('The operation timed out.', 'TimeoutError');
        }

        return response();
      }
    });

    let result = await run(model, {
      model: { slug: 'judge', model, pricing, requestsPerMinute: 18 },
      modelAccess: { limiter: { reserve }, maxWaitMs: 1000 },
      onLog
    });

    expect(result.verdict.consistent).toBe(true);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[1]!.abortSignal?.aborted).toBe(false);
    expect(delay).toHaveBeenCalledWith(1000, undefined, { signal: undefined });
    expect(onLog.mock.calls.flat().join('\n')).toContain('retrying in 1s');
  });

  it('allows a slow request three minutes, then retries after the SDK aborts it', async () => {
    vi.useFakeTimers();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) => {
        if (++calls == 1) {
          return new Promise<ReturnType<typeof response>>((_resolve, reject) => {
            abortSignal!.addEventListener('abort', () => reject(abortSignal!.reason), {
              once: true
            });
          });
        }

        return response();
      }
    });

    let result = run(model);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]!.abortSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect((await result).verdict.consistent).toBe(true);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0]!.abortSignal?.aborted).toBe(true);
    expect(model.doGenerateCalls[1]!.abortSignal?.aborted).toBe(false);
  });

  it('stops after three timed-out attempts with exponential backoff', async () => {
    let error = new DOMException('The operation timed out.', 'TimeoutError');
    let model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw error;
      }
    });

    await expect(run(model)).rejects.toBe(error);

    expect(model.doGenerateCalls).toHaveLength(3);
    expect(vi.mocked(delay).mock.calls.map(call => call[0])).toEqual([1000, 2000]);
  });

  it('does not retry a permanent provider error', async () => {
    let error = new APICallError({
      message: 'Invalid credentials',
      url: 'https://example.com',
      requestBodyValues: {},
      statusCode: 401,
      isRetryable: false
    });
    let model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw error;
      }
    });

    await expect(run(model)).rejects.toBe(error);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('preserves SDK retries for temporary provider errors', async () => {
    vi.useFakeTimers();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doGenerate: async () => {
        if (++calls == 1) {
          throw new APICallError({
            message: 'Service unavailable',
            url: 'https://example.com',
            requestBodyValues: {},
            statusCode: 503,
            isRetryable: true
          });
        }

        return response();
      }
    });

    let result = run(model);
    await vi.advanceTimersByTimeAsync(2000);

    expect((await result).verdict.consistent).toBe(true);
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it('never starts a request when the review is already aborted', async () => {
    let controller = new AbortController();
    let model = new MockLanguageModelV4({ doGenerate: response() });
    controller.abort(new DOMException('Review timed out', 'TimeoutError'));

    await expect(run(model, { abortSignal: controller.signal })).rejects.toBe(
      controller.signal.reason
    );
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it('does not retry when the overall review expires during a request', async () => {
    let controller = new AbortController();
    let error = new DOMException('Review timed out', 'TimeoutError');
    let model = new MockLanguageModelV4({
      doGenerate: async () => {
        controller.abort(error);
        throw controller.signal.reason;
      }
    });

    await expect(run(model, { abortSignal: controller.signal })).rejects.toBe(error);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('honors cancellation during retry backoff', async () => {
    let controller = new AbortController();
    let model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      }
    });

    await expect(
      run(model, {
        abortSignal: controller.signal,
        onLog: entry => {
          if (entry.includes('retrying')) controller.abort();
        }
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(delay).toHaveBeenCalledWith(1000, undefined, { signal: controller.signal });
  });
});
