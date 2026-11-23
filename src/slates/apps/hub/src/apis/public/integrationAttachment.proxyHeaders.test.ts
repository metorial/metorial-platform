import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  safeFetch: vi.fn()
}));

vi.mock('../../db', () => ({
  db: { slateAttachment: { findFirst: mocks.findFirst, findUniqueOrThrow: vi.fn() } }
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: vi.fn() })
}));
vi.mock('@lowerdeck/ssrf', () => ({ safeFetch: mocks.safeFetch }));
vi.mock('../../services/slateAttachmentRefresh', () => ({
  refreshableAttachmentInclude: {},
  slateAttachmentRefreshService: { refreshProxiedAttachment: vi.fn() }
}));
vi.mock('../../services/slateInstanceAuthHandler', () => ({
  slateAuthHandlerService: { getSlateInstanceAuth: vi.fn() }
}));
vi.mock('../../storage', () => ({ storage: {} }));

process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-signing-secret';
process.env.TOOL_ATTACHMENT_ROUTER_SECRET = 'test-router-secret';

let { integrationAttachmentApp } = await import('./integrationAttachment');

let request = () =>
  integrationAttachmentApp.request('/integration-attachment/shsa_1', {
    headers: {
      'metorial-tool-attachment-router-secret': 'test-router-secret',
      'metorial-prefer-url': '1'
    }
  });

let attachment = {
  id: 'shsa_1',
  oid: 1n,
  targetUrl: 'https://files.example.test/report.pdf',
  storageBucket: null,
  storageKey: null,
  refreshAfter: null,
  refreshFailureCount: 0,
  lastRefreshErrorCode: null,
  lastRefreshErrorMessage: null,
  authConfigOid: null,
  authConfig: null,
  tenant: { oid: 1n },
  headers: { 'x-upstream-auth': 'value' },
  query: null,
  mimeType: 'application/pdf'
};

let upstreamErrorBodyMaxBytes = 16 * 1024;

describe('proxied integration attachment responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      ...attachment,
      expiresAt: new Date(Date.now() + 60_000)
    });
  });

  it('forwards the content headers and drops everything else the upstream sent', async () => {
    let upstreamHeaders = new Headers({
      'content-type': 'application/pdf',
      'content-length': '9',
      'cache-control': 'private, max-age=60',
      etag: '"abc"',
      'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT',
      'clear-site-data': '"cookies", "storage"',
      'content-security-policy': "default-src 'none'",
      'content-disposition': 'inline',
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true',
      'service-worker-allowed': '/',
      link: '</script.js>; rel=preload',
      refresh: '0; url=https://other.example.test',
      location: 'https://other.example.test',
      'x-custom': 'value'
    });
    upstreamHeaders.append('set-cookie', 'session=upstream; Path=/; Domain=example.test');
    mocks.safeFetch.mockResolvedValue(
      new Response('pdf-bytes', { status: 200, headers: upstreamHeaders })
    );

    let response = await request();

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('pdf-bytes');
    expect(Object.fromEntries(response.headers.entries())).toEqual({
      'content-type': 'application/pdf',
      'content-length': '9',
      'cache-control': 'private, max-age=60',
      etag: '"abc"',
      'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT',
      'content-disposition': 'attachment',
      'x-content-type-options': 'nosniff',
      'metorial-attachment-result': 'direct',
      'x-powered-by': 'Metorial'
    });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('does not forward the length of a compressed upstream body', async () => {
    mocks.safeFetch.mockResolvedValue(
      new Response('decoded', {
        status: 200,
        headers: { 'content-encoding': 'gzip', 'content-length': '3' }
      })
    );

    let response = await request();

    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('content-encoding')).toBeNull();
    await expect(response.text()).resolves.toBe('decoded');
  });

  it('falls back to the stored media type when the upstream sends none', async () => {
    let upstream = new Response('pdf-bytes', { status: 200 });
    upstream.headers.delete('content-type');
    mocks.safeFetch.mockResolvedValue(upstream);

    let response = await request();

    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('streams a large upstream body through', async () => {
    let chunk = new Uint8Array(64 * 1024).fill(7);
    let chunkCount = 64;
    let sent = 0;
    mocks.safeFetch.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            if (sent++ < chunkCount) controller.enqueue(chunk);
            else controller.close();
          }
        }),
        { status: 200, headers: { 'content-type': 'application/octet-stream' } }
      )
    );

    let response = await request();
    let body = new Uint8Array(await response.arrayBuffer());

    expect(body.byteLength).toBe(chunk.byteLength * chunkCount);
  });

  it('reads only a bounded prefix of an upstream error body', async () => {
    let chunk = new TextEncoder().encode('e'.repeat(4 * 1024));
    let pulled = 0;
    let cancelled = false;
    mocks.safeFetch.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            pulled++;
            controller.enqueue(chunk);
          },
          cancel() {
            cancelled = true;
          }
        }),
        { status: 500, headers: { 'set-cookie': 'session=upstream' } }
      )
    );

    let response = await request();
    let body = (await response.json()) as { code: string; upstreamError: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('integration_attachment_upstream_error');
    expect(body.upstreamError).toBe('e'.repeat(upstreamErrorBodyMaxBytes));
    expect(pulled).toBeLessThanOrEqual(upstreamErrorBodyMaxBytes / chunk.byteLength + 2);
    expect(cancelled).toBe(true);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('keeps short upstream error bodies intact', async () => {
    mocks.safeFetch.mockResolvedValue(new Response('file not found', { status: 404 }));

    let response = await request();
    let body = (await response.json()) as { upstreamStatus: number; upstreamError: string };

    expect(body.upstreamStatus).toBe(404);
    expect(body.upstreamError).toBe('file not found');
  });
});
