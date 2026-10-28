import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { authHeaders, expectOk, mcp, rest, RestError } from './api';
import {
  expectAuthMatrix,
  expectError,
  expectPresented,
  expectServiceError,
  listAll
} from './assertions';
import { readSessionCookie } from './bootstrap';
import { assertE2EEnvironment, e2eEndpoint, metorialEndpoints } from './env';
import { startMcpTestServer } from './mcpServer';

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
        if (url.pathname === '/items') {
          let all = Array.from({ length: 5 }, (_, index) => ({ id: `item_${index}` }));
          let after = url.searchParams.get('after');
          let limit = Number(url.searchParams.get('limit'));
          let start = after ? all.findIndex(item => item.id === after) + 1 : 0;
          let items = all.slice(start, start + limit);
          return Response.json({
            object: 'list',
            items,
            pagination: {
              has_more_after: start + limit < all.length,
              has_more_before: start > 0
            }
          });
        }
        if (url.pathname === '/secured') {
          let authorization = request.headers.get('authorization');
          if (!authorization) {
            return Response.json(
              { object: 'error', ok: false, status: 401, code: 'unauthorized', message: 'no' },
              { status: 401 }
            );
          }
          return Response.json({ ok: true });
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

  test('expectError checks status and code', async () => {
    let response = await rest(`http://localhost:${server.port}`).get('/secured');
    expect(expectError(response, 401, 'unauthorized').message).toBe('no');
    expect(() => expectError(response, 403)).toThrow('Expected status 403');
    expect(() => expectError(response, 401, 'forbidden')).toThrow('Expected error code');
  });

  test('listAll follows cursors across pages', async () => {
    let items = await listAll(rest(`http://localhost:${server.port}`), '/items', { limit: 2 });
    expect(items.map(item => item.id)).toEqual([
      'item_0',
      'item_1',
      'item_2',
      'item_3',
      'item_4'
    ]);
  });

  test('expectAuthMatrix reports every mismatch', async () => {
    let base = `http://localhost:${server.port}`;
    let clients = { none: rest(base), key: rest(base, { apiKey: 'key' }) };
    let call = (client: ReturnType<typeof rest>) => client.get('/secured');

    let responses = await expectAuthMatrix(clients, call, { none: 401, key: [200, 204] });
    expect(responses.key.status).toBe(200);

    await expect(expectAuthMatrix(clients, call, { none: 200, key: 403 })).rejects.toThrow(
      /none: expected 200[\s\S]*key: expected 403/
    );
  });

  test('mcp parses event-stream responses and keeps the session', async () => {
    let client = mcp(`http://localhost:${server.port}/mcp`);
    let initialized = await client.initialize();
    expect(initialized.result).toEqual({ method: 'initialize' });
    expect(client.sessionId).toBe('session-1');
    expect((await client.listTools()).result).toEqual({ method: 'tools/list' });
  });
});

describe('expectServiceError', () => {
  test('matches the error code and reports anything else', async () => {
    let fail = (code: string) => Promise.reject({ data: { code, message: code } });

    expect((await expectServiceError(fail('not_found'), 'not_found')).message).toBe(
      'not_found'
    );
    await expect(expectServiceError(fail('forbidden'), 'not_found')).rejects.toThrow(
      'Expected a ServiceError "not_found"'
    );
    await expect(expectServiceError(Promise.resolve(1), 'not_found')).rejects.toThrow(
      'the call resolved'
    );
  });
});

describe('expectPresented', () => {
  test('accepts snake_case bodies and ignores user-defined keys', () => {
    let body = {
      object: 'session',
      id: 'ses_1',
      created_at: '2026-01-01',
      metadata: { someKey: 1 },
      providers: [{ provider_id: 'pro_1' }],
      tools: [{ input_schema: { properties: { someArg: {} } } }]
    };
    expect(expectPresented(body, 'session')).toBe(body);
  });

  test('flags internal oids, camelCase keys and wrong object types', () => {
    expect(() => expectPresented({ object: 'a', oid: 1 })).toThrow('oid');
    expect(() => expectPresented({ object: 'a', items: [{ instanceOid: 1 }] })).toThrow(
      'items[0].instanceOid'
    );
    expect(() => expectPresented({ object: 'a', createdAt: 1 })).toThrow('snake_case');
    expect(() => expectPresented({ object: 'a' }, 'b')).toThrow('Expected object "b"');
  });
});

describe('mcp test server', () => {
  test('serves initialize, tools/list and tools/call and records requests', async () => {
    let server = startMcpTestServer();
    try {
      let client = mcp(server.url);
      let initialized = await client.initialize();
      expect(initialized.result.serverInfo.name).toBe('metorial-e2e');
      expect(client.sessionId).toBeTruthy();

      let tools = await client.listTools();
      expect(tools.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
        'echo',
        'add'
      ]);

      let call = await client.request('tools/call', {
        name: 'add',
        arguments: { a: 2, b: 3 }
      });
      expect(call.result.content).toEqual([{ type: 'text', text: '5' }]);

      let unknown = await client.request('tools/call', { name: 'missing' });
      expect(unknown.error?.code).toBe(-32602);

      expect(server.requests.map(request => request.method)).toEqual([
        'initialize',
        'notifications/initialized',
        'tools/list',
        'tools/call',
        'tools/call'
      ]);
      expect(server.toolCalls()[0]).toEqual({ name: 'add', arguments: { a: 2, b: 3 } });
    } finally {
      await server.stop();
    }
  });

  test('rejects requests without the configured bearer token', async () => {
    let server = startMcpTestServer({ bearerToken: 'secret' });
    try {
      expect((await mcp(server.url).initialize()).status).toBe(401);
      expect((await mcp(server.url, { apiKey: 'secret' }).initialize()).status).toBe(200);
    } finally {
      await server.stop();
    }
  });
});
