import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { authHeaders, expectOk, mcp, rest, RestError } from './api';
import { readSessionCookie } from './bootstrap';
import { assertE2EEnvironment, e2eEndpoint, metorialEndpoints } from './env';

let originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('env', () => {
  test('resolves endpoints of the stack SUT', () => {
    process.env.CONTROL_E2E_ENDPOINTS = JSON.stringify({
      '@metorial/app-api': {
        api: 'http://localhost:4310',
        files: 'http://localhost:4318',
        integrations: 'http://localhost:4316',
        subspaceInternal: 'http://localhost:4317',
        mcp: 'http://localhost:4311'
      }
    });

    expect(metorialEndpoints()).toMatchObject({
      api: 'http://localhost:4310',
      mcp: 'http://localhost:4311',
      portal: undefined
    });
    expect(() => e2eEndpoint('@metorial/app-api', 'missing')).toThrow('No e2e endpoint');
  });

  test('refuses to run outside control', () => {
    delete process.env.CONTROL_E2E;
    expect(() => assertE2EEnvironment()).toThrow('control test:e2e');
    process.env.CONTROL_E2E = '1';
    expect(() => assertE2EEnvironment()).not.toThrow();
  });
});

describe('auth', () => {
  test('builds bearer, cookie and organization headers', () => {
    expect(
      authHeaders({ apiKey: 'metorial_sk_x', session: 'sess', organizationId: 'org_1' })
    ).toEqual({
      authorization: 'Bearer metorial_sk_x',
      cookie: 'metorial_oss_session_secret=sess',
      'metorial-organization-id': 'org_1'
    });
  });

  test('reads the session cookie from Set-Cookie headers', () => {
    let headers = new Headers();
    headers.append('Set-Cookie', 'other=1; Path=/');
    headers.append('Set-Cookie', 'metorial_oss_session_secret=abc%3D; Path=/; HttpOnly');
    expect(readSessionCookie(headers)).toBe('abc=');
  });
});

describe('http clients', () => {
  let server: ReturnType<typeof Bun.serve>;

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: async request => {
        let url = new URL(request.url);
        if (url.pathname === '/echo') {
          return Response.json({
            method: request.method,
            query: Object.fromEntries(url.searchParams),
            authorization: request.headers.get('authorization'),
            body: request.body ? await request.json() : null
          });
        }
        if (url.pathname === '/mcp') {
          let message = (await request.json()) as { id?: number; method: string };
          if (message.id === undefined) return new Response(null, { status: 202 });
          return new Response(
            `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { method: message.method } })}\n\n`,
            { headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 'session-1' } }
          );
        }
        return Response.json({ code: 'not_found' }, { status: 404 });
      }
    });
  });

  afterAll(() => {
    server.stop(true);
  });

  test('rest sends JSON with auth and query', async () => {
    let client = rest(`http://localhost:${server.port}`, { apiKey: 'key' });
    let response = await client.post(
      '/echo',
      { a: 1 },
      { query: { limit: 5, skip: undefined } }
    );
    expect(expectOk(response)).toEqual({
      method: 'POST',
      query: { limit: '5' },
      authorization: 'Bearer key',
      body: { a: 1 }
    });
  });

  test('expectOk throws with the response body', async () => {
    let response = await rest(`http://localhost:${server.port}`).get('/missing');
    expect(response.status).toBe(404);
    expect(() => expectOk(response)).toThrow(RestError);
    expect(() => expectOk(response)).toThrow('not_found');
  });

  test('mcp parses event-stream responses and keeps the session', async () => {
    let client = mcp(`http://localhost:${server.port}/mcp`);
    let initialized = await client.initialize();
    expect(initialized.result).toEqual({ method: 'initialize' });
    expect(client.sessionId).toBe('session-1');
    expect((await client.listTools()).result).toEqual({ method: 'tools/list' });
  });
});
