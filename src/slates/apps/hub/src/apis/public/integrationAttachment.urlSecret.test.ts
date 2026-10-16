import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getSlateInstanceAuth: vi.fn(),
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
  slateAuthHandlerService: { getSlateInstanceAuth: mocks.getSlateInstanceAuth }
}));
vi.mock('../../storage', () => ({ storage: {} }));

process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-signing-secret';
process.env.TOOL_ATTACHMENT_ROUTER_SECRET = 'test-router-secret';

let { integrationAttachmentApp } = await import('./integrationAttachment');

let request = () =>
  integrationAttachmentApp.request('/integration-attachment/shsa_tg', {
    headers: {
      'metorial-tool-attachment-router-secret': 'test-router-secret',
      'metorial-prefer-url': '1'
    }
  });

let attachment = {
  id: 'shsa_tg',
  oid: 1n,
  targetUrl:
    'https://api.telegram.org/file/bot$$MT$secret$authConfig$token$$/photos/file_1.jpg',
  storageBucket: null,
  storageKey: null,
  refreshAfter: null,
  refreshFailureCount: 0,
  lastRefreshErrorCode: null,
  lastRefreshErrorMessage: null,
  authConfigOid: 5n as bigint | null,
  authConfig: { id: 'cfg_1' },
  tenant: { oid: 1n },
  headers: null,
  query: null,
  mimeType: 'image/jpeg'
};

describe('integration attachment with a credential in its URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      ...attachment,
      expiresAt: new Date(Date.now() + 60_000)
    });
    mocks.getSlateInstanceAuth.mockResolvedValue({ output: { token: '123:LIVE-TOKEN' } });
    mocks.safeFetch.mockResolvedValue(new Response('jpeg-bytes', { status: 200 }));
  });

  it('proxies the file with the live token instead of returning the URL', async () => {
    let response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get('metorial-attachment-result')).toBe('direct');
    await expect(response.text()).resolves.toBe('jpeg-bytes');
    expect(mocks.safeFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/file/bot123:LIVE-TOKEN/photos/file_1.jpg',
      expect.objectContaining({ headers: {} })
    );
  });

  it('hides the live token in fetch errors', async () => {
    mocks.safeFetch.mockRejectedValueOnce(
      new Error(
        'connect failed: https://api.telegram.org/file/bot123:LIVE-TOKEN/photos/file_1.jpg'
      )
    );

    let response = await request();
    let body = await response.text();

    expect(body).toContain('integration_attachment_fetch_failed');
    expect(body).not.toContain('LIVE-TOKEN');
  });

  it('never hands out the URL, even without an auth config to resolve it', async () => {
    mocks.findFirst.mockResolvedValueOnce({
      ...attachment,
      authConfigOid: null,
      expiresAt: new Date(Date.now() + 60_000)
    });

    let response = await request();

    expect(response.headers.get('metorial-attachment-result')).not.toBe('url');
    expect(mocks.getSlateInstanceAuth).not.toHaveBeenCalled();
  });
});
