import { createError, ServiceError } from '@lowerdeck/error';
import type { GatewayPrincipal } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it, vi } from 'vitest';
import { createInferenceApp, type InferenceDependencies } from '../src/app';

let principal: GatewayPrincipal = {
  token: { id: 'gwtk_1', consumerRef: null, allowedModels: [], limits: {}, metadata: {} },
  organization: { id: 'gwor_1', ref: 'org' },
  project: { id: 'gwpr_1', ref: 'project' },
  instance: {
    id: 'gwin_1',
    ref: 'instance',
    logRetentionDays: 90,
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
let modelNotFound = createError({
  status: 404,
  code: 'model_not_found',
  message: 'No model.'
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
    route: vi.fn(async () => ({})),
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
    ['/v1/chat/completions', 'OpenAI Chat Completions'],
    ['/v1/responses', 'Open Responses'],
    ['/v1/messages', 'Anthropic Messages']
  ])('%s routes the model and answers 501 for now', async (path, name) => {
    let { request, deps } = setup();

    let response = await request(path, {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'anthropic/claude-sonnet-5', messages: [] }
    });

    expect(response.status).toBe(501);
    expect(JSON.stringify(await response.json())).toContain(name);
    expect(deps.route).toHaveBeenCalledWith({ principal, model: 'anthropic/claude-sonnet-5' });
  });

  it('requires a model', async () => {
    let { request } = setup();

    let response = await request('/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { messages: [] }
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'missing_model', param: 'model', type: 'invalid_request_error' }
    });
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

  it('passes routing errors through in the dialect shape', async () => {
    let { request } = setup({
      route: async () => {
        throw new ServiceError(modelNotFound());
      }
    });

    let response = await request('/v1/messages', {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
      json: { model: 'nope' }
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      type: 'error',
      error: { type: 'not_found_error', message: 'No model.' }
    });
  });

  it('hides unexpected errors', async () => {
    let { request } = setup({
      route: async () => {
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
