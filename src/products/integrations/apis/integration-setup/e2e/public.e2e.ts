import { uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { integrationsApi, integrationsUiUrl } from './_fixtures';

let preflightHeaders = (origin: string) => ({
  origin,
  'access-control-request-method': 'POST',
  'access-control-request-headers': 'content-type'
});

let disallowedOrigins = [
  'https://evil.example',
  'null',
  'http://localhost.evil.example',
  'https://integrations.metorial.com.evil.example',
  'file://localhost'
];

describe('api-integrations public routes', () => {
  let uiOrigin = () => new URL(integrationsUiUrl()).origin;
  let allowedOrigins = () => [
    uiOrigin(),
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://app.localhost:8080'
  ];

  it('grants CORS to the integrations UI and local development origins', async () => {
    let api = integrationsApi();

    for (let origin of allowedOrigins()) {
      let response = await api.get(`/tool-call-attachments/${uniqueId('x')}`, {
        headers: { origin }
      });
      expect(response.status, origin).toBe(403);
      expect(response.headers.get('access-control-allow-origin'), origin).toBe(origin);
      expect(response.headers.get('access-control-allow-credentials'), origin).toBe('true');
      expect(response.headers.get('vary'), origin).toMatch(/origin/i);

      let preflight = await api.request('OPTIONS', `/setup-session/${uniqueId('pss')}`, {
        headers: preflightHeaders(origin)
      });
      expect(preflight.status, origin).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin'), origin).toBe(origin);
      expect(preflight.headers.get('access-control-allow-methods'), origin).toContain('GET');
      expect(preflight.headers.get('access-control-max-age'), origin).toBe('86400');
    }
  });

  it('refuses CORS to every other origin', async () => {
    let api = integrationsApi();

    for (let origin of disallowedOrigins) {
      let response = await api.get(`/setup-session/${uniqueId('pss')}`, {
        headers: { origin }
      });
      expect(response.status, origin).toBe(302);
      expect(response.headers.get('access-control-allow-origin'), origin).toBeNull();
      expect(response.headers.get('access-control-allow-credentials'), origin).toBeNull();

      let preflight = await api.request('OPTIONS', `/tool-call-attachments/${uniqueId('x')}`, {
        headers: preflightHeaders(origin)
      });
      expect(preflight.status, origin).toBe(403);
      expect(preflight.headers.get('access-control-allow-origin'), origin).toBeNull();
    }

    let withoutOrigin = await api.request('OPTIONS', `/setup-session/${uniqueId('pss')}`);
    expect(withoutOrigin.status).toBe(204);
    expect(withoutOrigin.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('applies the same origin policy to the frontend RPC endpoints', async () => {
    let api = integrationsApi();

    for (let path of ['/integrations-api', '/subspace-public/internal-api']) {
      for (let origin of allowedOrigins()) {
        let preflight = await api.request('OPTIONS', path, {
          headers: preflightHeaders(origin)
        });
        expect(preflight.status, `${path} ${origin}`).toBe(204);
        expect(preflight.headers.get('access-control-allow-origin'), origin).toBe(origin);
        expect(preflight.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
      }

      for (let origin of disallowedOrigins) {
        let preflight = await api.request('OPTIONS', path, {
          headers: preflightHeaders(origin)
        });
        expect(preflight.status, `${path} ${origin}`).toBe(403);
        expect(preflight.headers.get('access-control-allow-origin'), origin).toBeNull();
      }
    }
  });

  it('redirects setup links to the integrations UI and keeps them on its origin', async () => {
    let api = integrationsApi();
    let ui = integrationsUiUrl();
    let sessionId = uniqueId('pss');
    let secret = uniqueId('secret');

    let setup = await api.get(`/setup-session/${sessionId}`, {
      query: { client_secret: secret, step: 'auth' }
    });
    expect(setup.status).toBe(302);
    expect(setup.headers.get('location')).toBe(
      `${ui}/setup-session/${sessionId}?client_secret=${secret}&step=auth`
    );

    let integration = await api.get(`/integration-setup-session/${sessionId}`, {
      query: { client_secret: secret }
    });
    expect(integration.status).toBe(302);
    expect(integration.headers.get('location')).toBe(
      `${ui}/integration-setup-session/${sessionId}?client_secret=${secret}`
    );

    for (let hostile of [
      '%2F%2Fevil.example',
      '..%2F..%2F..%2Fevil',
      '%5C%5Cevil.example',
      'https:%2F%2Fevil.example',
      '%40evil.example'
    ]) {
      for (let prefix of ['/setup-session', '/integration-setup-session']) {
        let response = await api.get(`${prefix}/${hostile}`);
        let location = response.headers.get('location');

        expect([302, 404], `${prefix}/${hostile}`).toContain(response.status);
        if (location) {
          expect(new URL(location, ui).origin, `${prefix}/${hostile}`).toBe(
            new URL(ui).origin
          );
        }
      }
    }
  });

  it('requires a valid client secret on oauth and integration setup links', async () => {
    let api = integrationsApi();
    let setupId = uniqueId('poas');
    let sessionId = uniqueId('iss');

    for (let path of [
      `/oauth-setup/${setupId}`,
      `/oauth-setup/${setupId}/callback`,
      `/integration-setup-session/${sessionId}/${uniqueId('step')}`
    ]) {
      let missing = await api.get(path);
      expect({ status: missing.status, text: missing.text }, path).toEqual({
        status: 400,
        text: 'Missing client_secret'
      });

      let wrong = await api.get(path, { query: { client_secret: uniqueId('secret') } });
      expect(wrong.status, path).toBe(404);
      expect(wrong.body, path).toMatchObject({ code: 'not_found' });
      expect(wrong.headers.get('location'), path).toBeNull();
    }
  });

  it('answers unknown routes, methods and oauth callbacks with stable error shapes', async () => {
    let api = integrationsApi();

    for (let [method, path] of [
      ['GET', `/${uniqueId('missing')}`],
      ['POST', `/setup-session/${uniqueId('pss')}`],
      ['DELETE', `/tool-call-attachments/${uniqueId('x')}`],
      ['GET', '/subspace-internal'],
      ['POST', '/subspace-internal'],
      ['GET', '/tool-call-attachments']
    ] as const) {
      let response = await api.request(method, path, method == 'POST' ? { body: {} } : {});
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(response.body, `${method} ${path}`).toMatchObject({
        object: 'error',
        status: 404,
        code: 'not_found'
      });
      expect(response.headers.get('x-powered-by')).toBe('Metorial');
    }

    for (let identifier of [uniqueId('unknown'), 'a', `${uniqueId('t')}-x-${uniqueId('y')}`]) {
      let callback = await api.get(`/oauth-callback/${identifier}`, {
        query: { code: 'abc', state: 'xyz' }
      });
      expect({ status: callback.status, text: callback.text }, identifier).toEqual({
        status: 400,
        text: 'Invalid oauth callback URL'
      });
    }
  });
});
