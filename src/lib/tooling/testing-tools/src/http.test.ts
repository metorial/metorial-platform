import { describe, expect, test } from 'vitest';
import { createFetchRouter, createTestServer } from './http';

describe('createFetchRouter', () => {
  test('routes matching requests and falls back to original fetch', async () => {
    const originalFetch = globalThis.fetch;

    const fakeFetch = (async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response('passthrough')) as typeof fetch;
    if (originalFetch && 'preconnect' in originalFetch) {
      fakeFetch.preconnect = originalFetch.preconnect;
    }
    globalThis.fetch = fakeFetch;

    const router = createFetchRouter();
    router.registerRoute('http://example.test/api', () => new Response('routed'));
    router.install();

    const routed = await fetch('http://example.test/api/health');
    expect(await routed.text()).toBe('routed');

    const fallback = await fetch('http://other.test/health');
    expect(await fallback.text()).toBe('passthrough');

    router.uninstall();
    globalThis.fetch = originalFetch;
  });
});

describe('createTestServer', () => {
  test('wraps a fetch handler', async () => {
    const server = createTestServer(request => {
      const url = new URL(request.url);
      return new Response(`${request.method}:${url.pathname}`);
    });

    const response = await server.get('/health');
    expect(await response.text()).toBe('GET:/health');
  });

  test('wraps a request handler', async () => {
    const server = createTestServer({
      request: async path => new Response(`ok:${path}`)
    });

    const response = await server.postJson('/ready', { ok: true });
    expect(await response.text()).toBe('ok:/ready');
  });
});
