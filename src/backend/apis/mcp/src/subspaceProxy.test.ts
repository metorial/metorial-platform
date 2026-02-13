import { ServiceError } from '@metorial/error';
import { Context } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-subspace', () => ({
  getSubspaceConnectionUrl: () => 'https://subspace.test/subspace-controller'
}));

import {
  buildMetorialProxyUrl,
  buildSubspaceProxyHeaders,
  buildSubspaceUrl,
  proxyMagicMcpRequestToSubspace
} from './subspaceProxy';

let sessionInfo = {
  subspaceSolutionId: 'solution/one',
  subspaceTenantIdentifier: 'tenant one',
  subspaceSessionId: 'session#1'
} as const;

let createContext = (request: Request) =>
  ({
    req: {
      url: request.url,
      method: request.method,
      raw: request
    }
  }) as unknown as Context;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('subspaceProxy', () => {
  it('builds subspace url with ignored query params removed and transportType set', () => {
    let reqUrl = new URL(
      'https://api.metorial.test/magic/server/sse?foo=bar&foo=baz&key=secret&oauth_session_id=abc&metorial_server_session_id=def'
    );

    let subspaceUrl = buildSubspaceUrl(
      'https://subspace.test/subspace-controller',
      sessionInfo,
      reqUrl,
      'sse'
    );

    expect(subspaceUrl.toString()).toBe(
      'https://subspace.test/subspace-controller/solution%2Fone/tenant%20one/sessions/session%231/mcp?foo=bar&foo=baz&transportType=sse'
    );
  });

  it('builds proxy url with key only for sse', () => {
    let reqUrl = new URL(
      'https://api.metorial.test/magic/server/sse?key=secret&foo=bar&oauth_session_id=abc'
    );

    expect(buildMetorialProxyUrl(reqUrl, 'sse')).toBe(
      'https://api.metorial.test/magic/server/sse?key=secret'
    );
    expect(buildMetorialProxyUrl(reqUrl, 'streamable_http')).toBe(
      'https://api.metorial.test/magic/server/sse'
    );
  });

  it('sanitizes forwarded headers and injects a sanitized proxy url header', () => {
    let headers = new Headers({
      host: 'api.metorial.test',
      'content-length': '100',
      authorization: 'Bearer secret',
      cookie: 'session=abc',
      connection: 'keep-alive',
      upgrade: 'websocket',
      te: 'trailers',
      trailer: 'x-test',
      'transfer-encoding': 'chunked',
      'mcp-protocol-version': '2025-06-18',
      'mcp-session-id': 'mcp_123',
      accept: 'text/event-stream'
    });

    let proxied = buildSubspaceProxyHeaders(
      headers,
      new URL('https://api.metorial.test/magic/server/http?key=secret&foo=bar'),
      'streamable_http'
    );

    expect(proxied.get('authorization')).toBeNull();
    expect(proxied.get('cookie')).toBeNull();
    expect(proxied.get('connection')).toBeNull();
    expect(proxied.get('upgrade')).toBeNull();
    expect(proxied.get('content-length')).toBeNull();
    expect(proxied.get('mcp-protocol-version')).toBe('2025-06-18');
    expect(proxied.get('mcp-session-id')).toBe('mcp_123');
    expect(proxied.get('Metorial-Proxy-URL')).toBe(
      'https://api.metorial.test/magic/server/http'
    );
  });

  it('proxies request to subspace with request signal and response metadata', async () => {
    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', {
        status: 201,
        headers: {
          'content-type': 'text/plain'
        }
      })
    );

    let request = new Request(
      'https://api.metorial.test/magic/server/http?key=secret&foo=bar',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret',
          'content-type': 'application/json',
          'mcp-protocol-version': '2025-06-18'
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize' })
      }
    );
    let c = createContext(request);

    let response = await proxyMagicMcpRequestToSubspace(
      c,
      {
        type: 'magic_mcp_subspace_session',
        ...sessionInfo
      } as any,
      'streamable_http'
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    let [targetUrl, init] = fetchSpy.mock.calls[0]!;
    expect((targetUrl as URL).toString()).toBe(
      'https://subspace.test/subspace-controller/solution%2Fone/tenant%20one/sessions/session%231/mcp?foo=bar&transportType=streamable_http'
    );

    let requestInit = init as RequestInit;
    let forwardedHeaders = new Headers(requestInit.headers as HeadersInit);
    expect(requestInit.signal).toBe(request.signal);
    expect(forwardedHeaders.get('authorization')).toBeNull();
    expect(forwardedHeaders.get('Metorial-Proxy-URL')).toBe(
      'https://api.metorial.test/magic/server/http'
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('Metorial-Subspace-Session-Id')).toBe('session#1');
  });

  it('rejects websocket transport', async () => {
    let request = new Request('https://api.metorial.test/magic/server/ws');
    let c = createContext(request);

    await expect(
      proxyMagicMcpRequestToSubspace(
        c,
        {
          type: 'magic_mcp_subspace_session',
          ...sessionInfo
        } as any,
        'websocket'
      )
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
