import { beforeEach, describe, expect, it, vi } from 'vitest';

// Focused unit test for the TOOL_ATTACHMENT_ROUTER_SECRET gate added to
// `integrationAttachmentApp`. Everything unrelated to that gate (storage,
// refresh, auth-config deserialization, redis locking) is mocked out so this
// can run under vitest.unit.config.ts without live infra.

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  usingLock: vi.fn(async (_key: unknown, fn: () => Promise<unknown>) => fn()),
  getPublicURL: vi.fn(),
  getObject: vi.fn()
}));

vi.mock('../../db', () => ({
  db: {
    slateAttachment: {
      findFirst: mocks.findFirst,
      findUniqueOrThrow: vi.fn()
    }
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: mocks.usingLock })
}));

// `slateAttachmentRefreshService` pulls in the function-bay/invocation stack,
// which performs a top-level DB upsert on import. Our test attachments never
// have a due `refreshAfter`, so `refreshIfDue` never actually calls this —
// mock the module to avoid that unrelated import-time side effect.
vi.mock('../../services/slateAttachmentRefresh', () => ({
  refreshableAttachmentInclude: {},
  slateAttachmentRefreshService: { refreshProxiedAttachment: vi.fn() }
}));

vi.mock('../../services/slateInstanceAuthHandler', () => ({
  slateAuthHandlerService: { getSlateInstanceAuth: vi.fn() }
}));

// `../../storage` performs top-level DB/bucket-provisioning calls on import.
// None of our test attachments use stored objects, so mock it out entirely.
vi.mock('../../storage', () => ({
  storage: { getPublicURL: mocks.getPublicURL, getObject: mocks.getObject }
}));

process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-signing-secret';
process.env.TOOL_ATTACHMENT_ROUTER_SECRET = 'test-router-secret';

let { integrationAttachmentApp } = await import('./integrationAttachment');

describe('integration attachment endpoint with a router secret configured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: 'shsa_123',
      oid: 1n,
      targetUrl: 'https://provider.example/file',
      storageBucket: null,
      storageKey: null,
      expiresAt: new Date(Date.now() + 60_000),
      refreshAfter: null,
      refreshFailureCount: 0,
      lastRefreshErrorCode: null,
      lastRefreshErrorMessage: null,
      authConfigOid: null,
      headers: null,
      query: null,
      mimeType: 'image/png'
    });
  });

  it('rejects requests without the router secret', async () => {
    let response = await integrationAttachmentApp.request('/integration-attachment/shsa_123', {
      headers: { 'metorial-prefer-url': '1' }
    });

    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('rejects requests with the router secret but without prefer-url', async () => {
    let response = await integrationAttachmentApp.request('/integration-attachment/shsa_123', {
      headers: { 'metorial-tool-attachment-router-secret': 'test-router-secret' }
    });

    expect(response.status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('resolves the attachment when the secret and prefer-url are both present', async () => {
    let response = await integrationAttachmentApp.request('/integration-attachment/shsa_123', {
      headers: {
        'metorial-tool-attachment-router-secret': 'test-router-secret',
        'metorial-prefer-url': '1'
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('metorial-attachment-result')).toBe('url');
    await expect(response.json()).resolves.toMatchObject({
      url: 'https://provider.example/file'
    });
  });

  it('mints stored-object URLs with seven minutes of headroom', async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: 'shsa_stored',
      oid: 2n,
      targetUrl: null,
      storageBucket: 'attachments',
      storageKey: 'uploads/shau_123',
      expiresAt: new Date(Date.now() + 60_000),
      refreshAfter: null,
      refreshFailureCount: 0,
      lastRefreshErrorCode: null,
      lastRefreshErrorMessage: null,
      authConfigOid: null,
      headers: null,
      query: null,
      mimeType: 'application/octet-stream'
    });
    mocks.getPublicURL.mockResolvedValueOnce({
      url: 'https://s3.example.com/object?signed=1'
    });

    let response = await integrationAttachmentApp.request(
      '/integration-attachment/shsa_stored',
      {
        headers: {
          'metorial-tool-attachment-router-secret': 'test-router-secret',
          'metorial-prefer-url': '1'
        }
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('metorial-attachment-result')).toBe('url');
    expect(mocks.getPublicURL).toHaveBeenCalledWith(
      'attachments',
      'uploads/shau_123',
      7 * 60,
      'retrieve'
    );
  });
});
