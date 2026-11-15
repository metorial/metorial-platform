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
  stream: new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'text-start', id: 'text' });
      controller.enqueue({ type: 'text-delta', id: 'text', delta: JSON.stringify(verdict) });
      controller.enqueue({ type: 'text-end', id: 'text' });
      controller.enqueue({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 100, text: 100, reasoning: 0 }
        }
      });
      controller.close();
    }
  })
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
    let model = new MockLanguageModelV4({ doStream: response() });
    let result = await run(model);

    expect(result.verdict).toEqual({ consistent: true, issues: [] });
    expect(result.usage.costMicros).toBe(1100);
    expect(model.doStreamCalls).toHaveLength(1);
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
      doStream: async () => response(++calls == 1 ? verdict : undefined)
    });

    let result = await run(model, {
      onUsage,
      reviewInstructions: 'Static review of intended behavior.'
    });

    expect(result.verdict).toEqual({ consistent: true, issues: [] });
    expect(model.doStreamCalls).toHaveLength(2);
    expect(result.usage.costMicros).toBe(2200);
    expect(onUsage).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(model.doStreamCalls[1]!.prompt)).toContain(
      'previous response did not satisfy'
    );
    expect(JSON.stringify(model.doStreamCalls[0]!.prompt)).toContain(
      'Static review of intended behavior.'
    );
  });

  it('does not accept an endlessly malformed response as report feedback', async () => {
    let onUsage = vi.fn();
    let model = new MockLanguageModelV4({
      doStream: async () => response({ consistent: false, issues: [{ section: 'scores' }] })
    });

    await expect(run(model, { onUsage })).rejects.toThrow('Verdict must contain');
    expect(model.doStreamCalls).toHaveLength(3);
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
    let model = new MockLanguageModelV4({ doStream: response(verdict) });

    expect((await run(model)).verdict).toEqual(verdict);
  });

  it('retries a timed-out request with a fresh signal and another rate-limit slot', async () => {
    let reserve = vi.fn(async () => 0);
    let onLog = vi.fn();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doStream: async () => {
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
    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls[1]!.abortSignal?.aborted).toBe(false);
    expect(delay).toHaveBeenCalledWith(1000, undefined, { signal: undefined });
    expect(onLog.mock.calls.flat().join('\n')).toContain('retrying in 1s');
  });

  it('retries a request that produces no output for 90 seconds', async () => {
    vi.useFakeTimers();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) => {
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
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0]!.abortSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(30 * 1000);
    expect((await result).verdict.consistent).toBe(true);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls[0]!.abortSignal?.aborted).toBe(true);
    expect(model.doStreamCalls[1]!.abortSignal?.aborted).toBe(false);
  });

  it('logs streamed reasoning before completion and reports progress during quiet periods', async () => {
    vi.useFakeTimers();
    let onLog = vi.fn();
    let streamController: ReadableStreamDefaultController<any>;
    let model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            streamController = controller;
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'reasoning-start', id: 'reasoning' });
            controller.enqueue({
              type: 'reasoning-delta',
              id: 'reasoning',
              delta: 'Checking the selected resource scope.'
            });
          }
        })
      })
    });
    let completed = false;
    let result = run(model, { onLog }).then(value => {
      completed = true;
      return value;
    });

    await vi.waitFor(() =>
      expect(onLog.mock.calls.flat().join('\n')).toContain(
        'thinking: Checking the selected resource scope.'
      )
    );
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(onLog.mock.calls.flat().join('\n')).toContain('output characters');

    streamController!.enqueue({ type: 'reasoning-end', id: 'reasoning' });
    let final = response();
    let reader = final.stream.getReader();
    for (;;) {
      let part = await reader.read();
      if (part.done) break;
      if (part.value.type != 'stream-start') streamController!.enqueue(part.value);
    }
    streamController!.close();

    expect((await result).verdict.consistent).toBe(true);
    expect(onLog.mock.calls.flat().join('\n')).toContain('said:');
    expect(onLog.mock.calls.flat().join('\n')).toContain('1000 in / 100 out');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows an actively streaming check to finish after the old three-minute cutoff', async () => {
    vi.useFakeTimers();
    let onLog = vi.fn();
    let model = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'reasoning-start', id: 'reasoning' });
            let ticks = 0;
            let interval = setInterval(async () => {
              controller.enqueue({
                type: 'reasoning-delta',
                id: 'reasoning',
                delta: 'Checking another claim. '
              });
              if (++ticks < 4) return;
              clearInterval(interval);
              controller.enqueue({ type: 'reasoning-end', id: 'reasoning' });
              let reader = response().stream.getReader();
              for (;;) {
                let part = await reader.read();
                if (part.done) break;
                if (part.value.type != 'stream-start') controller.enqueue(part.value);
              }
              controller.close();
            }, 60_000);
            abortSignal!.addEventListener(
              'abort',
              () => {
                clearInterval(interval);
                controller.error(abortSignal!.reason);
              },
              { once: true }
            );
          }
        })
      })
    });
    let result = run(model, { onLog });
    await vi.advanceTimersByTimeAsync(4 * 60_000);

    expect((await result).verdict.consistent).toBe(true);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0]!.abortSignal?.aborted).toBe(false);
    expect(model.doStreamCalls[0]!.maxOutputTokens).toBe(8192);
    expect(onLog.mock.calls.flat().join('\n')).toContain('Checking another claim.');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('switches to the fallback when a model stalls after beginning its response', async () => {
    vi.useFakeTimers();
    let onLog = vi.fn();
    let fallback = new MockLanguageModelV4({ doStream: async () => response() });
    let primary = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'reasoning-start', id: 'reasoning' });
            controller.enqueue({
              type: 'reasoning-delta',
              id: 'reasoning',
              delta: 'Checking the finding.'
            });
            abortSignal!.addEventListener(
              'abort',
              () => controller.error(abortSignal!.reason),
              { once: true }
            );
          }
        })
      })
    });
    let result = run(primary, {
      model: {
        slug: 'primary',
        model: primary,
        pricing,
        fallback: { slug: 'fallback', model: fallback, pricing }
      },
      onLog
    });
    await vi.advanceTimersByTimeAsync(90_000);

    expect((await result).verdict.consistent).toBe(true);
    expect(primary.doStreamCalls).toHaveLength(1);
    expect(fallback.doStreamCalls).toHaveLength(1);
    let logs = onLog.mock.calls.flat().join('\n');
    expect(logs).toContain('thinking: Checking the finding.');
    expect(logs).toContain('received no model output for 90s');
    expect(logs).toContain('switching from primary to fallback');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds an endlessly active response by the total deadline', async () => {
    vi.useFakeTimers();
    let onLog = vi.fn();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) => {
        if (++calls > 1) return response();
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'reasoning-start', id: 'reasoning' });
              let interval = setInterval(
                () =>
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: 'reasoning',
                    delta: 'Still checking. '
                  }),
                60_000
              );
              abortSignal!.addEventListener(
                'abort',
                () => {
                  clearInterval(interval);
                  controller.error(abortSignal!.reason);
                },
                { once: true }
              );
            }
          })
        };
      }
    });
    let result = run(model, { onLog });
    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect((await result).verdict.consistent).toBe(true);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(onLog.mock.calls.flat().join('\n')).toContain('exceeded 600s total limit');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops after three timed-out attempts with exponential backoff', async () => {
    let error = new DOMException('The operation timed out.', 'TimeoutError');
    let model = new MockLanguageModelV4({
      doStream: async () => {
        throw error;
      }
    });

    await expect(run(model)).rejects.toBe(error);

    expect(model.doStreamCalls).toHaveLength(3);
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
      doStream: async () => {
        throw error;
      }
    });

    await expect(run(model)).rejects.toBe(error);
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it('preserves SDK retries for temporary provider errors', async () => {
    vi.useFakeTimers();
    let calls = 0;
    let model = new MockLanguageModelV4({
      doStream: async () => {
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
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it('never starts a request when the review is already aborted', async () => {
    let controller = new AbortController();
    let model = new MockLanguageModelV4({ doStream: response() });
    controller.abort(new DOMException('Review timed out', 'TimeoutError'));

    await expect(run(model, { abortSignal: controller.signal })).rejects.toBe(
      controller.signal.reason
    );
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('does not retry when the overall review expires during a request', async () => {
    let controller = new AbortController();
    let error = new DOMException('Review timed out', 'TimeoutError');
    let model = new MockLanguageModelV4({
      doStream: async () => {
        controller.abort(error);
        throw controller.signal.reason;
      }
    });

    await expect(run(model, { abortSignal: controller.signal })).rejects.toBe(error);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('honors cancellation during retry backoff', async () => {
    let controller = new AbortController();
    let model = new MockLanguageModelV4({
      doStream: async () => {
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
    expect(model.doStreamCalls).toHaveLength(1);
    expect(delay).toHaveBeenCalledWith(1000, undefined, { signal: controller.signal });
  });
});
