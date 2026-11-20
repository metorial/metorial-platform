import { createError, ServiceError } from '@lowerdeck/error';
import type { SseEvent } from '@mtsrc/ai-gateway-dialects';
import type { InferenceRequest, InferenceResult } from '@mtsrc/ai-gateway-module-inference';
import type { GatewayPrincipal } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it, vi } from 'vitest';
import { createInferenceApp, type InferenceDependencies } from '../src/app';

let principal: GatewayPrincipal = {
  token: { id: 'gwtk_1', consumerRef: null, allowedModels: [], limits: [], metadata: {} },
  organization: { id: 'gwor_1', ref: 'org' },
  project: {
    id: 'gwpr_1',
    ref: 'project',
    platformLimits: [],
    disabled: null,
    billingRestriction: null
  },
  instance: {
    id: 'gwin_1',
    ref: 'instance',
    logRetentionDays: 90,
    limits: [],
    settings: {
      contentLogging: { enabled: false, retentionDays: 7 },
      metorialProviderEnabled: true,
      fallbacksEnabled: true,
      zdrRequired: false
    }
  }
};

let invalidToken = createError({
  status: 401,
  code: 'invalid_credential',
  message: 'Bad token.'
});
let models = [
  {
    slug: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    labSlug: 'anthropic',
    releaseDate: new Date('2026-09-01T00:00:00Z'),
    createdAt: new Date('2026-10-01T00:00:00Z')
  }
];

let setup = (overrides: Partial<InferenceDependencies> = {}) => {
  let deps: InferenceDependencies = {
    extractToken: headers =>
      headers.authorization?.replace(/^Bearer /, '') ?? headers.apiKey ?? undefined,
    authenticate: vi.fn(async token => {
      if (token != 'good') throw new ServiceError(invalidToken());
      return principal;
    }),
    run: vi.fn<(request: InferenceRequest) => Promise<InferenceResult>>(async () => ({
      type: 'json',
      body: { ok: true },
      headers: {}
    })),
    listModels: vi.fn(async () => models),
    ...overrides
  };

  let app = createInferenceApp(deps);

  let request = (path: string, init: RequestInit & { json?: unknown } = {}) =>
    app.request(path, {
      ...init,
      body: init.json === undefined ? init.body : JSON.stringify(init.json),
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
    });

  return { deps, request };
};

describe('authentication', () => {
  it('rejects requests without a valid token in the OpenAI shape', async () => {
    let { request } = setup();

    let response = await request('/v1/chat/completions', { method: 'POST', json: {} });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(await response.json()).toEqual({
      error: {
        message: 'Bad token.',
        type: 'authentication_error',
        param: null,
        code: 'invalid_credential'
      }
    });
  });

  it('rejects requests without a valid token in the Anthropic shape', async () => {
    let { request } = setup();

    let response = await request('/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': 'bad', 'anthropic-version': '2023-06-01' },
      json: {}
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      type: 'error',
      error: { type: 'authentication_error', message: 'Bad token.' }
    });
  });

  it('accepts Anthropic-style x-api-key tokens', async () => {
    let { request, deps } = setup();

    await request('/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': 'good' },
      json: { model: 'claude' }
    });

    expect(deps.authenticate).toHaveBeenCalledWith('good');
  });
});

describe('inference endpoints', () => {
  it.each([
    ['/v1/chat/completions', 'openai_chat'],
    ['/v1/responses', 'open_responses'],
    ['/v1/messages', 'anthropic_messages']
  ])('%s hands the request to the runner', async (path, dialect) => {
    let { request, deps } = setup();
    let body = { model: 'anthropic/claude-sonnet-5', messages: [] };

    let response = await request(path, {
      method: 'POST',
      headers: {
        authorization: 'Bearer good',
        'user-agent': 'sdk/1.0',
        'x-request-id': 'req_9'
      },
      json: body
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deps.run).toHaveBeenCalledWith({
      principal,
      dialect,
      body,
      metadata: {},
      countTokens: undefined,
      requestId: 'req_9',
      userAgent: 'sdk/1.0',
      signal: expect.any(AbortSignal),
      receivedAt: expect.any(Date)
    });
  });

  it('counts tokens through the runner', async () => {
    let { request, deps } = setup({
      run: vi.fn(async () => ({
        type: 'json' as const,
        body: { input_tokens: 5 },
        headers: {}
      }))
    });

    let response = await request('/v1/messages/count_tokens', {
      method: 'POST',
      headers: { 'x-api-key': 'good' },
      json: { model: 'claude', messages: [] }
    });

    expect(await response.json()).toEqual({ input_tokens: 5 });
    expect(deps.run).toHaveBeenCalledWith(
      expect.objectContaining({ dialect: 'anthropic_messages', countTokens: true })
    );
  });

  it('sends the runner headers with JSON responses', async () => {
    let { request } = setup({
      run: async () => ({
        type: 'json',
        body: { id: 'x' },
        headers: { 'x-metorial-request-id': 'gwlg_1', 'x-metorial-provider': 'metorial' }
      })
    });

    let response = await request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'x' }
    });

    expect(response.headers.get('x-metorial-request-id')).toBe('gwlg_1');
    expect(response.headers.get('x-metorial-provider')).toBe('metorial');
  });

  it('answers runner errors in the dialect shape with their headers', async () => {
    let { request } = setup({
      run: async () => ({
        type: 'error',
        error: { status: 429, code: 'upstream_rate_limited', message: 'Slow down.' },
        headers: { 'retry-after': '3', 'x-metorial-request-id': 'gwlg_1' }
      })
    });

    let response = await request('/v1/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'x' }
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('3');
    expect(response.headers.get('x-metorial-request-id')).toBe('gwlg_1');
    expect(await response.json()).toEqual({
      type: 'error',
      error: { type: 'rate_limit_error', message: 'Slow down.' }
    });
  });

  it('serves streams as server-sent events', async () => {
    let events: SseEvent[] = [
      { event: 'message_start', data: '{"type":"message_start"}' },
      { data: '[DONE]' }
    ];
    let { request } = setup({
      run: async () => ({
        type: 'stream',
        events: new ReadableStream({
          start: controller => {
            events.forEach(event => controller.enqueue(event));
            controller.close();
          }
        }),
        headers: { 'x-metorial-request-id': 'gwlg_1' }
      })
    });

    let response = await request('/v1/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'x', stream: true }
    });

    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('x-metorial-request-id')).toBe('gwlg_1');
    expect(await response.text()).toBe(
      'event: message_start\ndata: {"type":"message_start"}\n\ndata: [DONE]\n\n'
    );
  });

  it('keeps idle streams alive with comment lines', async () => {
    let { request } = setup({
      keepAliveMs: 5,
      run: async () => ({
        type: 'stream',
        events: new ReadableStream({
          start: async controller => {
            await new Promise(resolve => setTimeout(resolve, 40));
            controller.enqueue({ data: '[DONE]' });
            controller.close();
          }
        }),
        headers: {}
      })
    });

    let response = await request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'x', stream: true }
    });
    let text = await response.text();

    expect(text).toMatch(/^(: ping\n\n)+data: \[DONE\]\n\n$/);
  });

  it('cancels the runner stream when the client stops reading', async () => {
    let cancelled = vi.fn();
    let { request } = setup({
      run: async () => ({
        type: 'stream',
        events: new ReadableStream<SseEvent>({
          start: controller => controller.enqueue({ data: '{"a":1}' }),
          cancel: cancelled
        }),
        headers: {}
      })
    });

    let response = await request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'x', stream: true }
    });
    let reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();

    expect(cancelled).toHaveBeenCalled();
  });

  it('passes request metadata to the runner', async () => {
    let { request, deps } = setup();

    await request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer good',
        'x-metorial-metadata': JSON.stringify({ session: 'abc', tier: 'free' })
      },
      json: { model: 'smart', messages: [] }
    });

    expect(deps.run).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { session: 'abc', tier: 'free' } })
    );
  });

  it.each([
    ['not json', '{nope'],
    ['an array', '["a"]'],
    ['a non-string value', '{"count": 3}'],
    [
      'too many entries',
      JSON.stringify(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 'v'])))
    ]
  ])('rejects metadata that is %s', async (_, header) => {
    let { request, deps } = setup();

    let response = await request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer good', 'x-metorial-metadata': header },
      json: { model: 'smart', messages: [] }
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_metadata' } });
    expect(deps.run).not.toHaveBeenCalled();
  });

  it('rejects bodies declared larger than the limit', async () => {
    let { request, deps } = setup();

    let response = await request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer good', 'content-length': String(33 * 1024 * 1024) },
      json: { model: 'x' }
    });

    expect(response.status).toBe(413);
    expect(deps.run).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON', async () => {
    let { request } = setup();

    let response = await request('/v1/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      body: '{nope'
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'The request body must be valid JSON.' }
    });
  });

  it('hides unexpected errors', async () => {
    let { request } = setup({
      run: async () => {
        throw new Error('database exploded with secrets');
      }
    });

    let response = await request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'x' }
    });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('secrets');
  });
});

describe('models', () => {
  it('lists models in the OpenAI shape by default', async () => {
    let { request } = setup();

    let response = await request('/v1/models', { headers: { authorization: 'Bearer good' } });

    expect(await response.json()).toEqual({
      object: 'list',
      data: [
        {
          id: 'anthropic/claude-sonnet-5',
          object: 'model',
          created: Date.parse('2026-09-01T00:00:00Z') / 1000,
          owned_by: 'anthropic'
        }
      ]
    });
  });

  it('lists models in the Anthropic shape for Anthropic clients', async () => {
    let { request } = setup();

    let response = await request('/v1/models', {
      headers: { 'x-api-key': 'good', 'anthropic-version': '2023-06-01' }
    });

    expect(await response.json()).toEqual({
      data: [
        {
          type: 'model',
          id: 'anthropic/claude-sonnet-5',
          display_name: 'Claude Sonnet 5',
          created_at: '2026-09-01T00:00:00.000Z'
        }
      ],
      has_more: false,
      first_id: 'anthropic/claude-sonnet-5',
      last_id: 'anthropic/claude-sonnet-5'
    });
  });

  it('retrieves a single model including slashes in its id', async () => {
    let { request } = setup();

    let found = await request('/v1/models/anthropic/claude-sonnet-5', {
      headers: { authorization: 'Bearer good' }
    });
    let missing = await request('/v1/models/openai/gpt-6', {
      headers: { authorization: 'Bearer good' }
    });

    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ id: 'anthropic/claude-sonnet-5' });
    expect(missing.status).toBe(404);
  });
});

describe('routing', () => {
  it('answers unknown routes with a dialect error', async () => {
    let { request } = setup();

    let response = await request('/v1/embeddings', { method: 'POST', json: {} });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'route_not_found' } });
  });

  it('answers CORS preflights', async () => {
    let { request } = setup();

    let response = await request('/v1/chat/completions', {
      method: 'OPTIONS',
      headers: { origin: 'https://example.com', 'access-control-request-method': 'POST' }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });
});
