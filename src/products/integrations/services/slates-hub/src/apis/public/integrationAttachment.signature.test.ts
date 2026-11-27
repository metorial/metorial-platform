import { beforeEach, describe, expect, it, vi } from 'vitest';

// Focused unit test for the unsigned-access gate on `integrationAttachmentApp`
// when TOOL_ATTACHMENT_ROUTER_SECRET is unset. Everything unrelated (storage,
// refresh, auth-config deserialization, redis locking) is mocked out so this
// can run under vitest.unit.config.ts without live infra.

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  usingLock: vi.fn(async (_key: unknown, fn: () => Promise<unknown>) => fn())
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

vi.mock('../../services/slateAttachmentRefresh', () => ({
  refreshableAttachmentInclude: {},
  slateAttachmentRefreshService: { refreshProxiedAttachment: vi.fn() }
}));

vi.mock('../../services/slateInstanceAuthHandler', () => ({
  slateAuthHandlerService: { getSlateInstanceAuth: vi.fn() }
}));

vi.mock('../../storage', () => ({
  storage: { getPublicURL: vi.fn(), getObject: vi.fn() }
}));

vi.mock('../../env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://127.0.0.1:6379',
      SERVICE_PUBLIC_URL: 'http://127.0.0.1:4310'
    },
    secrets: {
      SLATE_ATTACHMENT_SIGNING_SECRET: 'test-signing-secret'
    }
  }
}));

process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-signing-secret';

let { integrationAttachmentApp } = await import('./integrationAttachment');
let { signAttachmentId, signedIntegrationAttachmentUrl } = await import(
  '../../lib/attachmentSignature'
);

describe('signedIntegrationAttachmentUrl', () => {
  it('includes the attachment id plus ts and sig query params', async () => {
    let url = new URL(await signedIntegrationAttachmentUrl('shsa_123'));
    expect(url.pathname).toBe('/integration-attachment/shsa_123');
    expect(url.searchParams.get('ts')).toBeTruthy();
    expect(url.searchParams.get('sig')).toBeTruthy();
  });
});

describe('integration attachment endpoint without a router secret', () => {
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

  it('rejects unsigned requests before looking up the attachment', async () => {
    let response = await integrationAttachmentApp.request('/integration-attachment/shsa_123');

    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('rejects requests that only include a timestamp', async () => {
    let response = await integrationAttachmentApp.request(
      '/integration-attachment/shsa_123?ts=1'
    );

    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid signature', async () => {
    let { ts } = await signAttachmentId('shsa_123');
    let response = await integrationAttachmentApp.request(
      `/integration-attachment/shsa_123?ts=${ts}&sig=not-a-real-signature`
    );

    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('resolves the attachment when a valid signature is present', async () => {
    let { ts, sig } = await signAttachmentId('shsa_123');
    let response = await integrationAttachmentApp.request(
      `/integration-attachment/shsa_123?ts=${ts}&sig=${encodeURIComponent(sig)}`,
      { headers: { 'metorial-prefer-url': '1' } }
    );

    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      url: 'https://provider.example/file'
    });
  });
});
