import type { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { createError, ServiceError } from '@lowerdeck/error';
import { summarizeRequest } from '@mtsrc/ai-gateway-request-features';
import { createMockModel, type Script } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it, vi } from 'vitest';
import type { InferenceLimiter } from '../src/lib/limiter';
import type { InferenceResult } from '../src/lib/runner';
import {
  bodies,
  createControlledModel,
  createHangingModel,
  customerCandidate,
  dialects,
  eventData,
  finishPart,
  platformCandidate,
  principalWith,
  readEvents,
  routeOf,
  setupRunner,
  textParts
} from './fixtures';

let hello: Script = { steps: [{ type: 'text', text: 'Hello world' }] };

let failing = (status: number, headers?: Record<string, string>) =>
  createMockModel({
    steps: [],
    httpError: { status, body: { error: { message: `status ${status}` } }, headers }
  });

let partsModel = (parts: LanguageModelV4StreamPart[]): LanguageModelV4 => ({
  ...createMockModel(hello),
  doStream: async () => ({
    stream: new ReadableStream<LanguageModelV4StreamPart>({
      start: controller => {
        parts.forEach(part => controller.enqueue(part));
        controller.close();
      }
    })
  })
});

let expectJson = (result: InferenceResult) => {
  if (result.type != 'json') throw new Error(`Expected json, got ${JSON.stringify(result)}`);
  return result;
};

let expectStream = (result: InferenceResult) => {
  if (result.type != 'stream')
    throw new Error(`Expected a stream, got ${JSON.stringify(result)}`);
  return result;
};

let expectError = (result: InferenceResult) => {
  if (result.type != 'error') throw new Error(`Expected an error, got ${result.type}`);
  return result;
};

let tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('successful requests', () => {
  it('answers a buffered request and logs usage, cost, route and timings', async () => {
    let model = createMockModel(hello);
    let { run, logs } = setupRunner({ models: { off_1: model } });

    let result = expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));

    expect(result.body).toMatchObject({
      id: 'chatcmpl-gwlg_1',
      object: 'chat.completion',
      model: 'openai/gpt-test',
      choices: [
        { message: { role: 'assistant', content: 'Hello world' }, finish_reason: 'stop' }
      ],
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 }
    });
    expect(result.headers).toEqual({
      'x-metorial-request-id': 'gwlg_1',
      'x-metorial-model': 'openai/gpt-test',
      'x-metorial-provider': 'openai'
    });

    expect(logs).toHaveLength(1);
    let { log, retentionDays, content } = logs[0]!;
    expect(retentionDays).toBe(30);
    expect(content).toBeUndefined();
    expect(log).toMatchObject({
      _id: 'gwlg_1',
      organizationId: 'gwor_1',
      projectId: 'gwpr_1',
      instanceId: 'gwin_1',
      tokenId: 'gwtk_1',
      consumerRef: 'consumer_1',
      dialect: 'openai_chat',
      operation: 'generate',
      requestedModel: 'openai/gpt-test',
      status: 'succeeded',
      finishReason: 'stop',
      model: { slug: 'openai/gpt-test', labSlug: 'openai' },
      route: {
        connectionOwner: 'customer',
        connectionId: 'conn_1',
        providerSlug: 'openai',
        offeringId: 'off_1',
        vendorModelId: 'vendor-model-1'
      },
      usage: {
        input: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
        output: { total: 7, text: 7, reasoning: 0 }
      },
      request: { messageCount: 1, toolCount: 0 }
    });
    expect(log.error).toBeUndefined();
    expect(log.metadata).toBeUndefined();
    expect(log.attempts).toHaveLength(1);
    expect(log.attempts[0]).toMatchObject({ connectionId: 'conn_1', outcome: 'succeeded' });

    expect(log.billedCost!.totalUsd).toBeCloseTo((12 * 2 + 7 * 10) / 1e6, 12);
    expect(log.billedCost!.pricingSource).toBe('offering');
    expect(log.providerCost!.totalUsd).toBeCloseTo((12 * 1 + 7 * 5) / 1e6, 12);

    let timing = log.timing;
    expect(timing.totalMs).toBeGreaterThan(0);
    expect(timing.upstreamStartedAt).toBeInstanceOf(Date);
    expect(timing.upstreamMs).toBeGreaterThan(0);
    expect(timing.firstTokenAt).toBeInstanceOf(Date);
    expect(timing.timeToFirstTokenMs).toBeGreaterThan(0);
    expect(timing.completedAt.getTime()).toBeGreaterThan(timing.receivedAt.getTime());
  });

  it('streams a request and logs it once the stream finished', async () => {
    let { run, logs } = setupRunner({ models: { off_1: createMockModel(hello) } });

    let result = expectStream(
      await run({
        dialect: 'openai_chat',
        body: bodies.openai_chat({ stream: true, stream_options: { include_usage: true } })
      })
    );
    expect(result.headers['x-metorial-request-id']).toBe('gwlg_1');
    expect(logs).toHaveLength(0);

    let data = eventData(await readEvents(result.events));
    let text = data
      .filter(chunk => chunk != '[DONE]')
      .map(chunk => chunk.choices?.[0]?.delta?.content ?? '')
      .join('');

    expect(text).toBe('Hello world');
    expect(data.at(-1)).toBe('[DONE]');
    expect(data.at(-2)).toMatchObject({ choices: [], usage: { prompt_tokens: 12 } });

    expect(logs).toHaveLength(1);
    expect(logs[0]!.log).toMatchObject({
      operation: 'stream',
      status: 'succeeded',
      finishReason: 'stop'
    });
    expect(logs[0]!.log.timing.timeToFirstTokenMs).toBeGreaterThan(0);
  });

  for (let dialect of dialects) {
    it(`answers ${dialect} buffered and streamed requests with the same content`, async () => {
      let script: Script = {
        steps: [
          { type: 'reasoning', text: 'Thinking it over', signature: 'sig' },
          { type: 'text', text: 'Let me check.' },
          { type: 'tool-call', id: 'call_1', name: 'lookup', input: { city: 'Berlin' } }
        ]
      };
      let tools = {
        openai_chat: {
          tools: [
            { type: 'function', function: { name: 'lookup', parameters: { type: 'object' } } }
          ]
        },
        anthropic_messages: { tools: [{ name: 'lookup', input_schema: { type: 'object' } }] },
        open_responses: {
          tools: [{ type: 'function', name: 'lookup', parameters: { type: 'object' } }]
        }
      }[dialect];

      let buffered = setupRunner({ models: { off_1: createMockModel(script) } });
      let json = expectJson(await buffered.run({ dialect, body: bodies[dialect](tools) }));
      expect(buffered.logs[0]!.log).toMatchObject({
        status: 'succeeded',
        finishReason: 'tool-calls'
      });
      expect(buffered.logs[0]!.log.request).toMatchObject({ toolCount: 1 });

      let streamed = setupRunner({ models: { off_1: createMockModel(script) } });
      let stream = expectStream(
        await streamed.run({ dialect, body: bodies[dialect]({ ...tools, stream: true }) })
      );
      let events = await readEvents(stream.events);

      expect(events.length).toBeGreaterThan(3);
      expect(streamed.logs[0]!.log).toMatchObject({
        operation: 'stream',
        status: 'succeeded',
        finishReason: 'tool-calls'
      });

      // The log stores the same aggregate a buffered request would have answered with.
      let streamedContent = setupRunner({ models: { off_1: createMockModel(script) } });
      let withContent = principalWith({ contentLogging: { enabled: true, retentionDays: 3 } });
      let contentStream = expectStream(
        await streamedContent.run(
          { dialect, body: bodies[dialect]({ ...tools, stream: true }) },
          withContent
        )
      );
      await readEvents(contentStream.events);
      expect(streamedContent.logs[0]!.content!.response).toEqual(json.body);
    });
  }

  it('reports the Metorial provider and charges spend for platform routes', async () => {
    let settle = vi.fn<InferenceLimiter['settle']>(async () => {});
    let { run, logs } = setupRunner({
      route: routeOf([platformCandidate(1)]),
      models: { off_1: createMockModel(hello) },
      limiter: { acquire: async () => ({ allowed: true, headers: {} }), settle }
    });

    let result = expectJson(
      await run({ dialect: 'anthropic_messages', body: bodies.anthropic_messages() })
    );

    expect(result.headers['x-metorial-provider']).toBe('metorial');
    expect(result.body).toMatchObject({ id: 'msg_gwlg_1', model: 'anthropic/claude-test' });
    expect(logs[0]!.log.route).toEqual({
      connectionOwner: 'platform',
      platformConnectionSlug: 'anthropic-main',
      routingRuleSlug: 'anthropic-direct',
      providerSlug: 'anthropic',
      offeringId: 'off_1',
      vendorModelId: 'vendor-model-1'
    });
    expect(logs[0]!.log.billedCost!.pricingSource).toBe('routing_rule');
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({
        metorialBilled: true,
        billedCostUsd: logs[0]!.log.billedCost!.totalUsd
      })
    );
  });

  it('prices cache writes at the one-hour rate when the request asks for it', async () => {
    let model = createMockModel({
      ...hello,
      usage: { input: 10, output: 0, cacheWrite: 1000 }
    });
    let { run, logs } = setupRunner({ models: { off_1: model } });

    await run({
      dialect: 'anthropic_messages',
      body: bodies.anthropic_messages({
        system: [
          {
            type: 'text',
            text: 'Long prompt',
            cache_control: { type: 'ephemeral', ttl: '1h' }
          }
        ]
      })
    });

    expect(logs[0]!.log.billedCost!.components.cacheWrite).toBeCloseTo((1000 * 4) / 1e6, 12);
  });

  it('applies virtual model overrides and provider option preparation to the call', async () => {
    let model = createMockModel(hello);
    let { run, logs, deps } = setupRunner({
      route: routeOf([customerCandidate(1)], {
        overrides: { maxOutputTokens: 50, temperature: 0.3, reasoningEffort: 'low' },
        virtualModel: {
          id: 'gwvm_1',
          slug: 'cheap',
          versionId: 'gwvv_1',
          versionNumber: 2,
          ruleId: null,
          reason: 'default',
          trace: [],
          targets: ['openai/gpt-test'],
          skippedTargets: [],
          decision: null
        }
      }),
      models: { off_1: model },
      prepareOptions: ({ options }) => ({
        ...options,
        providerOptions: { openai: { store: false } }
      })
    });

    await run({
      dialect: 'openai_chat',
      body: bodies.openai_chat({ model: 'cheap', max_tokens: 4000, temperature: 1.5 })
    });

    expect(deps.prepareOptions).toHaveBeenCalledWith(
      expect.objectContaining({ providerSlug: 'openai' })
    );
    expect(model.calls[0]).toMatchObject({
      maxOutputTokens: 50,
      temperature: 0.3,
      reasoning: 'low',
      providerOptions: { openai: { store: false } }
    });
    expect(model.calls[0]!.abortSignal).toBeInstanceOf(AbortSignal);
    expect(deps.route).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'cheap', dialect: 'openai_chat' })
    );
    expect(logs[0]!.log.requestedModel).toBe('cheap');
    expect(logs[0]!.log.virtualModel).toMatchObject({ slug: 'cheap', versionNumber: 2 });
  });

  it('passes request metadata and identifiers into the log', async () => {
    let { run, logs } = setupRunner({ models: { off_1: createMockModel(hello) } });

    await run({
      dialect: 'open_responses',
      body: bodies.open_responses(),
      metadata: { feature: 'search' },
      requestId: 'req_1',
      userAgent: 'test-agent/1.0'
    });

    expect(logs[0]!.log).toMatchObject({
      metadata: { feature: 'search' },
      requestId: 'req_1',
      request: { userAgent: 'test-agent/1.0' }
    });
  });

  it('logs request and response content only when the instance enables it', async () => {
    let enabled = setupRunner({ models: { off_1: createMockModel(hello) } });
    let principal = principalWith({ contentLogging: { enabled: true, retentionDays: 3 } });
    let body = bodies.openai_chat();
    let result = expectJson(await enabled.run({ dialect: 'openai_chat', body }, principal));

    expect(enabled.logs[0]!.content).toEqual({
      request: body,
      response: result.body,
      retentionDays: 3
    });

    let disabled = setupRunner({ models: { off_1: createMockModel(hello) } });
    await disabled.run({ dialect: 'openai_chat', body });
    expect(disabled.logs[0]!.content).toBeUndefined();
  });

  it('still answers when the log store throws', async () => {
    let { run } = setupRunner({
      models: { off_1: createMockModel(hello) },
      recordLog: () => {
        throw new Error('mongo is down');
      }
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));
  });
});

describe('rejections', () => {
  it('rejects an unsupported parameter and logs it as rejected at the request stage', async () => {
    let { run, logs, deps } = setupRunner({ models: { off_1: createMockModel(hello) } });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat({ n: 3 }) })
    );

    expect(result.error).toMatchObject({ status: 400, param: 'n' });
    expect(result.headers).toEqual({ 'x-metorial-request-id': 'gwlg_1' });
    expect(deps.route).not.toHaveBeenCalled();
    expect(logs[0]!.log).toMatchObject({
      status: 'rejected',
      requestedModel: 'openai/gpt-test',
      attempts: [],
      error: { stage: 'request', param: 'n', httpStatus: 400, code: result.error.code }
    });
    expect(logs[0]!.log.route).toBeUndefined();
  });

  it('logs a malformed body with an empty requested model', async () => {
    let { run, logs } = setupRunner({ models: {} });

    expectError(await run({ dialect: 'anthropic_messages', body: [1, 2] }));

    expect(logs[0]!.log).toMatchObject({
      status: 'rejected',
      requestedModel: '',
      error: { stage: 'request' }
    });
  });

  it('rejects a request over its limits before routing and passes the limit headers on', async () => {
    let acquire = vi.fn<InferenceLimiter['acquire']>(async d => {
      expect(d.estimateInputTokens()).toBeGreaterThan(0);
      return {
        allowed: false,
        error: { status: 429, code: 'rate_limit_exceeded', message: 'Token limit reached.' },
        headers: { 'x-ratelimit-remaining-tokens': '0' }
      };
    });
    let { run, logs, deps } = setupRunner({
      models: {},
      limiter: { acquire, settle: async () => {} }
    });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
    );

    expect(result.error.code).toBe('rate_limit_exceeded');
    expect(result.headers['x-ratelimit-remaining-tokens']).toBe('0');
    expect(deps.route).not.toHaveBeenCalled();
    expect(logs[0]!.log).toMatchObject({
      status: 'rejected',
      error: { stage: 'limits', code: 'rate_limit_exceeded', httpStatus: 429 },
      request: { messageCount: 1 }
    });
  });

  it('allows the request when the limiter itself fails', async () => {
    let { run } = setupRunner({
      models: { off_1: createMockModel(hello) },
      limiter: {
        acquire: async () => {
          throw new Error('redis is down');
        },
        settle: async () => {}
      }
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));
  });

  it('logs routing errors as rejected at the routing stage', async () => {
    let notFound = createError({
      status: 404,
      code: 'model_not_found',
      message: 'No such model.'
    });
    let { run, logs } = setupRunner({
      route: async () => {
        throw new ServiceError(notFound());
      },
      models: {}
    });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
    );

    expect(result.error).toEqual({
      status: 404,
      code: 'model_not_found',
      message: 'No such model.'
    });
    expect(logs[0]!.log).toMatchObject({
      status: 'rejected',
      error: { stage: 'routing', code: 'model_not_found' }
    });
  });

  it('logs unexpected routing failures as failed without leaking details', async () => {
    let { run, logs } = setupRunner({
      route: async () => {
        throw new Error('database connection lost');
      },
      models: {}
    });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
    );

    expect(result.error).toMatchObject({ status: 500, code: 'internal_server_error' });
    expect(result.error.message).not.toContain('database');
    expect(logs[0]!.log).toMatchObject({ status: 'failed', error: { stage: 'routing' } });
  });

  it('turns internal bugs into a 500 instead of throwing', async () => {
    let { run } = setupRunner({
      route: async () => ({ requestedModel: 'x' }) as never,
      models: {}
    });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
    );
    expect(result.error.status).toBe(500);
  });
});

describe('fallback', () => {
  let retryable = [401, 403, 404, 408, 409, 429, 500, 502, 503, 529];
  let terminal = [400, 413, 422];

  for (let status of retryable) {
    it(`falls back to the next candidate after a ${status}`, async () => {
      let first = failing(status);
      let second = createMockModel(hello);
      let { run, logs, deps } = setupRunner({
        route: routeOf([
          customerCandidate(1),
          customerCandidate(2, { providerSlug: 'anthropic' })
        ]),
        models: { off_1: first, off_2: second }
      });

      let result = expectJson(
        await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
      );

      expect(result.headers['x-metorial-provider']).toBe('anthropic');
      expect(first.calls).toHaveLength(1);
      expect(second.calls).toHaveLength(1);
      expect(logs[0]!.log.route).toMatchObject({ connectionId: 'conn_2' });
      expect(logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual([
        'failed',
        'succeeded'
      ]);
      expect(logs[0]!.log.attempts[0]).toMatchObject({
        connectionId: 'conn_1',
        error: { stage: 'upstream', httpStatus: status }
      });

      if (status == 401 || status == 403) {
        expect(deps.reportAuthFailure).toHaveBeenCalledWith(
          expect.objectContaining({ connectionId: 'conn_1' })
        );
      } else {
        expect(deps.reportAuthFailure).not.toHaveBeenCalled();
      }
    });
  }

  for (let status of terminal) {
    it(`does not fall back after a ${status}, which another provider would reject too`, async () => {
      let second = createMockModel(hello);
      let { run, logs } = setupRunner({
        route: routeOf([customerCandidate(1), customerCandidate(2)]),
        models: { off_1: failing(status), off_2: second }
      });

      let result = expectError(
        await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
      );

      expect(result.error).toMatchObject({
        status: status == 413 ? 413 : 400,
        code: 'upstream_invalid_request'
      });
      expect(result.error.message).toContain(`status ${status}`);
      expect(second.calls).toHaveLength(0);
      expect(logs[0]!.log).toMatchObject({
        status: 'failed',
        error: { stage: 'upstream', httpStatus: status, code: 'upstream_invalid_request' },
        route: { connectionId: 'conn_1' }
      });
      expect(logs[0]!.log.attempts).toHaveLength(1);
    });
  }

  it('falls back after a network error', async () => {
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: {
        off_1: createMockModel(() => {
          throw new TypeError('fetch failed');
        }),
        off_2: createMockModel(hello)
      }
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));
    expect(logs[0]!.log.attempts[0]!.error).toMatchObject({ code: 'upstream_unreachable' });
  });

  it('falls back when a connection cannot be prepared', async () => {
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: { off_1: createMockModel(hello), off_2: createMockModel(hello) },
      resolveConnection: async candidate => {
        if (candidate.connectionOwner == 'customer' && candidate.connectionId == 'conn_1') {
          throw new Error('decryption failed');
        }
        return { credentials: { apiKey: 'sk' }, config: {} };
      }
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));
    expect(logs[0]!.log.attempts[0]!.error).toMatchObject({ code: 'connection_unavailable' });
  });

  it('returns the last error with retry-after when every candidate failed', async () => {
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: { off_1: failing(500), off_2: failing(429, { 'retry-after': '7' }) }
    });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
    );

    expect(result.error).toMatchObject({ status: 429, code: 'upstream_rate_limited' });
    expect(result.headers['retry-after']).toBe('7');
    expect(logs[0]!.log).toMatchObject({
      status: 'failed',
      error: { code: 'upstream_rate_limited', httpStatus: 429 },
      route: { connectionId: 'conn_2' }
    });
    expect(logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual([
      'failed',
      'failed'
    ]);
    expect(logs[0]!.log.usage).toBeUndefined();
  });

  it('never charges a failed request', async () => {
    let settle = vi.fn(async () => {});
    let { run } = setupRunner({
      models: { off_1: failing(500) },
      limiter: { acquire: async () => ({ allowed: true, headers: {} }), settle }
    });

    expectError(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));
    expect(settle).not.toHaveBeenCalled();
  });

  it('tries at most four candidates', async () => {
    let models = Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [`off_${n}`, failing(500)]));
    let { run, logs } = setupRunner({
      route: routeOf([1, 2, 3, 4, 5, 6].map(n => customerCandidate(n))),
      models
    });

    expectError(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));

    expect(logs[0]!.log.attempts).toHaveLength(4);
    expect(models.off_5!.calls).toHaveLength(0);
  });

  it('only tries the first candidate when the instance disabled fallbacks', async () => {
    let second = createMockModel(hello);
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: { off_1: failing(500), off_2: second }
    });

    expectError(
      await run(
        { dialect: 'openai_chat', body: bodies.openai_chat() },
        principalWith({ fallbacksEnabled: false })
      )
    );

    expect(second.calls).toHaveLength(0);
    expect(logs[0]!.log.attempts).toHaveLength(1);
  });

  it('hides provider details from platform route errors and reports their auth failures', async () => {
    let { run, deps } = setupRunner({
      route: routeOf([platformCandidate(1)]),
      models: { off_1: failing(401) }
    });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
    );

    expect(result.error).toEqual({
      status: 502,
      code: 'upstream_authentication_failed',
      message: 'The model provider is temporarily unavailable.'
    });
    expect(deps.reportAuthFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionOwner: 'platform',
        platformConnectionSlug: 'anthropic-main'
      })
    );
  });

  it('lets a buffered request fall back after an error halfway through the response', async () => {
    let second = createMockModel({ steps: [{ type: 'text', text: 'Second try' }] });
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: {
        off_1: createMockModel({ ...hello, failMidStream: { message: 'overloaded' } }),
        off_2: second
      }
    });

    let result = expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));

    expect(result.body).toMatchObject({ choices: [{ message: { content: 'Second try' } }] });
    expect(logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual([
      'failed',
      'succeeded'
    ]);
  });

  it('lets a buffered request fall back when the stream ends without finishing', async () => {
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: { off_1: partsModel(textParts('Partial')), off_2: createMockModel(hello) }
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));
    expect(logs[0]!.log.attempts[0]!.error).toMatchObject({ code: 'upstream_incomplete' });
  });

  it('lets a stream fall back while nothing was sent yet', async () => {
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: {
        off_1: createMockModel({ steps: [], failMidStream: { message: 'overloaded' } }),
        off_2: createMockModel(hello)
      }
    });

    let result = expectStream(
      await run({
        dialect: 'anthropic_messages',
        body: bodies.anthropic_messages({ stream: true })
      })
    );
    let events = await readEvents(result.events);

    expect(events.map(event => event.event).at(-1)).toBe('message_stop');
    expect(result.headers['x-metorial-request-id']).toBe('gwlg_1');
    expect(logs[0]!.log).toMatchObject({
      status: 'succeeded',
      route: { connectionId: 'conn_2' }
    });
    expect(logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual([
      'failed',
      'succeeded'
    ]);
  });
});

describe('stream failures after the response started', () => {
  it('ends an OpenAI chat stream with an error chunk and no [DONE]', async () => {
    let second = createMockModel(hello);
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: {
        off_1: createMockModel({ ...hello, failMidStream: { message: 'overloaded' } }),
        off_2: second
      }
    });

    let result = expectStream(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat({ stream: true }) })
    );
    let data = eventData(await readEvents(result.events));

    expect(second.calls).toHaveLength(0);
    expect(data).not.toContain('[DONE]');
    expect(data.at(-1)).toMatchObject({ error: { code: 'upstream_error' } });
    expect(logs[0]!.log).toMatchObject({
      status: 'failed',
      error: { stage: 'upstream', code: 'upstream_error' }
    });
    expect(logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual(['failed']);
  });

  it('ends an Anthropic stream with an error event', async () => {
    let { run } = setupRunner({
      models: {
        off_1: createMockModel({ ...hello, failMidStream: { message: 'overloaded' } })
      }
    });

    let result = expectStream(
      await run({
        dialect: 'anthropic_messages',
        body: bodies.anthropic_messages({ stream: true })
      })
    );
    let events = await readEvents(result.events);

    expect(events.at(-1)!.event).toBe('error');
    expect(JSON.parse(events.at(-1)!.data)).toMatchObject({
      type: 'error',
      error: { type: 'api_error' }
    });
  });

  it('ends an Open Responses stream with response.failed', async () => {
    let { run } = setupRunner({
      models: {
        off_1: createMockModel({ ...hello, failMidStream: { message: 'overloaded' } })
      }
    });

    let result = expectStream(
      await run({ dialect: 'open_responses', body: bodies.open_responses({ stream: true }) })
    );
    let events = await readEvents(result.events);

    expect(events.map(event => event.event).slice(-2)).toEqual(['error', 'response.failed']);
  });

  it('logs a stream that ends without finishing as incomplete and keeps what was sent', async () => {
    let controlled = createControlledModel(textParts('Partial'));
    let { run, logs } = setupRunner({
      models: { off_1: controlled.model }
    });
    let principal = principalWith({ contentLogging: { enabled: true, retentionDays: 1 } });

    let result = expectStream(
      await run(
        { dialect: 'openai_chat', body: bodies.openai_chat({ stream: true }) },
        principal
      )
    );
    let reader = result.events.getReader();
    await reader.read();
    controlled.close();

    let rest: string[] = [];
    while (true) {
      let next = await reader.read();
      if (next.done) break;
      rest.push(next.value.data);
    }

    expect(JSON.parse(rest.at(-1)!)).toMatchObject({ error: { code: 'upstream_incomplete' } });
    expect(logs[0]!.log).toMatchObject({
      status: 'failed',
      error: { code: 'upstream_incomplete' }
    });
    expect(logs[0]!.content!.response).toMatchObject({
      choices: [{ message: { content: 'Partial' } }]
    });
  });

  it('reports a stream that throws while reading as an upstream error', async () => {
    let controlled = createControlledModel(textParts());
    let { run, logs } = setupRunner({ models: { off_1: controlled.model } });

    let result = expectStream(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat({ stream: true }) })
    );
    let reader = result.events.getReader();
    await reader.read();
    controlled.error(new TypeError('fetch failed'));

    while (!(await reader.read()).done) {}

    expect(logs[0]!.log).toMatchObject({
      status: 'failed',
      error: { code: 'upstream_unreachable' }
    });
  });
});

describe('cancellation', () => {
  it('logs a stream the client stopped reading as cancelled and aborts the upstream call', async () => {
    let controlled = createControlledModel(textParts());
    let { run, logs } = setupRunner({ models: { off_1: controlled.model } });

    let result = expectStream(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat({ stream: true }) })
    );
    let reader = result.events.getReader();
    await reader.read();
    await reader.cancel();
    await tick();

    expect(controlled.calls[0]!.abortSignal!.aborted).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.log).toMatchObject({
      status: 'cancelled',
      error: { code: 'client_closed_request' }
    });
    expect(logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual(['cancelled']);
  });

  it('logs a stream whose request was aborted as cancelled', async () => {
    let controlled = createControlledModel(textParts());
    let { run, logs } = setupRunner({ models: { off_1: controlled.model } });
    let abort = new AbortController();

    let result = expectStream(
      await run({
        dialect: 'openai_chat',
        body: bodies.openai_chat({ stream: true }),
        signal: abort.signal
      })
    );
    let reader = result.events.getReader();
    await reader.read();
    abort.abort();

    while (!(await reader.read()).done) {}

    expect(logs).toHaveLength(1);
    expect(logs[0]!.log).toMatchObject({
      status: 'cancelled',
      error: { code: 'client_closed_request' }
    });
  });

  it('stops waiting for the provider when the client goes away before the response started', async () => {
    let hanging = createHangingModel();
    let second = createMockModel(hello);
    let { run, logs } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: { off_1: hanging.model, off_2: second }
    });
    let abort = new AbortController();

    let pending = run({
      dialect: 'openai_chat',
      body: bodies.openai_chat(),
      signal: abort.signal
    });
    await tick();
    abort.abort();
    let result = expectError(await pending);

    expect(result.error).toMatchObject({ status: 499, code: 'client_closed_request' });
    expect(hanging.calls[0]!.abortSignal!.aborted).toBe(true);
    expect(second.calls).toHaveLength(0);
    expect(logs[0]!.log).toMatchObject({ status: 'cancelled' });
    expect(logs[0]!.log.attempts.map(attempt => attempt.outcome)).toEqual(['cancelled']);
  });

  it('does not log twice when the client cancels after the stream finished', async () => {
    let controlled = createControlledModel([...textParts(), finishPart()]);
    let { run, logs } = setupRunner({ models: { off_1: controlled.model } });

    let result = expectStream(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat({ stream: true }) })
    );
    await readEvents(result.events);
    await result.events.cancel().catch(() => {});

    expect(logs).toHaveLength(1);
    expect(logs[0]!.log.status).toBe('succeeded');
  });
});

describe('limits', () => {
  it('settles what a successful request used and passes acquire headers on', async () => {
    let settle = vi.fn<InferenceLimiter['settle']>(async () => {});
    let { run, logs } = setupRunner({
      models: { off_1: createMockModel(hello) },
      limiter: {
        acquire: async () => ({
          allowed: true,
          headers: { 'x-ratelimit-remaining-requests': '9' }
        }),
        settle
      }
    });

    let result = expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));

    expect(result.headers['x-ratelimit-remaining-requests']).toBe('9');
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle.mock.calls[0]![0]).toMatchObject({
      metorialBilled: false,
      usage: { input: { total: 12 }, output: { total: 7 } },
      billedCostUsd: logs[0]!.log.billedCost!.totalUsd
    });
  });

  it('still answers when settling fails', async () => {
    let { run } = setupRunner({
      models: { off_1: createMockModel(hello) },
      limiter: {
        acquire: async () => ({ allowed: true, headers: {} }),
        settle: async () => {
          throw new Error('redis is down');
        }
      }
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));
  });

  it.each(dialects)('tells the limiter which dialect it answers in (%s)', async dialect => {
    let acquire = vi.fn<InferenceLimiter['acquire']>(async () => ({
      allowed: true,
      headers: {}
    }));
    let { run } = setupRunner({
      models: { off_1: createMockModel(hello) },
      limiter: { acquire, settle: async () => {} }
    });

    await run({ dialect, body: bodies[dialect]() });

    expect(acquire.mock.calls[0]![0].dialect).toBe(dialect);
  });

  let metorialBillingLimited = (onEnforced = vi.fn()) => ({
    onEnforced,
    limiter: {
      acquire: async () => ({
        allowed: true as const,
        headers: {},
        metorialBillingLimit: {
          error: {
            status: 429,
            code: 'plan_limit_exceeded',
            message: 'Plan allowance used up.'
          },
          onEnforced
        }
      }),
      settle: vi.fn<InferenceLimiter['settle']>(async () => {})
    }
  });

  it('skips Metorial-billed candidates once the plan allowance is used up', async () => {
    let { limiter, onEnforced } = metorialBillingLimited();
    let platformModel = createMockModel(hello);
    let customerModel = createMockModel(hello);
    let { run, logs } = setupRunner({
      route: routeOf([platformCandidate(1), customerCandidate(2)]),
      models: { off_1: platformModel, off_2: customerModel },
      limiter
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));

    expect(platformModel.calls).toHaveLength(0);
    expect(customerModel.calls).toHaveLength(1);
    expect(onEnforced).toHaveBeenCalledTimes(1);
    expect(logs[0]!.log).toMatchObject({
      status: 'succeeded',
      route: { connectionOwner: 'customer', offeringId: 'off_2' }
    });
    expect(limiter.settle.mock.calls[0]![0].metorialBilled).toBe(false);
  });

  it('rejects at the limits stage when only Metorial-billed candidates could serve', async () => {
    let { limiter, onEnforced } = metorialBillingLimited();
    let model = createMockModel(hello);
    let { run, logs } = setupRunner({
      route: routeOf([platformCandidate(1)]),
      models: { off_1: model },
      limiter
    });

    let result = expectError(
      await run({ dialect: 'openai_chat', body: bodies.openai_chat() })
    );

    expect(result.error).toMatchObject({ status: 429, code: 'plan_limit_exceeded' });
    expect(model.calls).toHaveLength(0);
    expect(onEnforced).toHaveBeenCalledTimes(1);
    expect(logs[0]!.log).toMatchObject({
      status: 'rejected',
      error: { stage: 'limits', code: 'plan_limit_exceeded', httpStatus: 429 }
    });
  });

  it('leaves routes without Metorial-billed candidates untouched', async () => {
    let { limiter, onEnforced } = metorialBillingLimited();
    let { run } = setupRunner({
      route: routeOf([customerCandidate(1), customerCandidate(2)]),
      models: { off_1: createMockModel(hello), off_2: createMockModel(hello) },
      limiter
    });

    expectJson(await run({ dialect: 'openai_chat', body: bodies.openai_chat() }));

    expect(onEnforced).not.toHaveBeenCalled();
  });
});

describe('count tokens', () => {
  let countBody = bodies.anthropic_messages({ max_tokens: undefined });

  it('answers with the exact provider count without touching limits or the model', async () => {
    let acquire = vi.fn(async () => ({ allowed: true as const, headers: {} }));
    let model = createMockModel(hello);
    let { run, logs, deps } = setupRunner({
      route: routeOf([platformCandidate(1)]),
      models: { off_1: model },
      countTokens: async () => 42,
      limiter: { acquire, settle: async () => {} }
    });

    let result = expectJson(
      await run({ dialect: 'anthropic_messages', body: countBody, countTokens: true })
    );

    expect(result.body).toEqual({ input_tokens: 42 });
    expect(acquire).not.toHaveBeenCalled();
    expect(model.calls).toHaveLength(0);
    expect(deps.countTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        body: countBody,
        candidate: expect.objectContaining({ offeringId: 'off_1' })
      })
    );
    expect(logs[0]!.log).toMatchObject({
      operation: 'count_tokens',
      status: 'succeeded',
      usage: { input: { total: 42 }, output: { total: 0 } }
    });
    expect(logs[0]!.log.billedCost).toBeUndefined();
  });

  it('estimates when the provider cannot count', async () => {
    let { run } = setupRunner({ models: {}, countTokens: async () => null });

    let result = expectJson(
      await run({ dialect: 'anthropic_messages', body: countBody, countTokens: true })
    );
    let estimate = summarizeRequest('anthropic_messages', countBody).estimatedInputTokens;

    expect(estimate).toBeGreaterThan(0);
    expect(result.body).toEqual({ input_tokens: estimate });
  });

  it('estimates when the provider count fails', async () => {
    let { run } = setupRunner({
      models: {},
      countTokens: async () => {
        throw new Error('count failed');
      }
    });

    let result = expectJson(
      await run({ dialect: 'anthropic_messages', body: countBody, countTokens: true })
    );
    expect((result.body as { input_tokens: number }).input_tokens).toBeGreaterThan(0);
  });
});
