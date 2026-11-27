import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getSlateInstanceAuth: vi.fn(),
  safeFetch: vi.fn(),
  gatewayFetch: vi.fn(),
  resolveEgressSubject: vi.fn()
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
vi.mock('../../lib/network/egressGateway', () => ({
  isGatewayEgress: () => true,
  getEgressGateway: vi.fn(),
  resolveEgressSubject: mocks.resolveEgressSubject
}));
vi.mock('../../lib/network/gatewayFetch', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/network/gatewayFetch')>()),
  gatewayFetch: mocks.gatewayFetch
}));

process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-signing-secret';
process.env.TOOL_ATTACHMENT_ROUTER_SECRET = 'test-router-secret';

let { integrationAttachmentApp } = await import('./integrationAttachment');
let { EgressGatewayRefusedError } = await import('../../lib/network/gatewayFetch');

let request = () =>
  integrationAttachmentApp.request('/integration-attachment/shsa_tg', {
    headers: {
      'metorial-tool-attachment-router-secret': 'test-router-secret',
      'metorial-prefer-url': '1'
    }
  });

let tenant = { oid: 1n, id: 'tnt_1' };

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
  authConfigOid: 5n,
  authConfig: { id: 'cfg_1' },
  tenant,
  instanceConfiguration: {
    enclaveId: 'enc_live',
    egressPolicy: { entries: [{ cidr: '10.0.0.0/8' }] }
  },
  enclaveId: null,
  egressPolicy: null,
  headers: null,
  query: null,
  mimeType: 'image/jpeg'
};

let subject = { tenantId: 'fbtn_1', enclaveId: 'enc_live' };

describe('integration attachment downloads through the egress gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      ...attachment,
      expiresAt: new Date(Date.now() + 60_000)
    });
    mocks.getSlateInstanceAuth.mockResolvedValue({ output: { token: '123:LIVE-TOKEN' } });
    mocks.resolveEgressSubject.mockResolvedValue(subject);
    mocks.gatewayFetch.mockResolvedValue(new Response('jpeg-bytes', { status: 200 }));
  });

  it('downloads with the live policy of the instance configuration', async () => {
    let response = await request();

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('jpeg-bytes');
    expect(mocks.safeFetch).not.toHaveBeenCalled();
    expect(mocks.resolveEgressSubject).toHaveBeenCalledWith({
      tenant,
      enclaveId: 'enc_live',
      egressPolicy: { entries: [{ cidr: '10.0.0.0/8' }] }
    });
    expect(mocks.gatewayFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/file/bot123:LIVE-TOKEN/photos/file_1.jpg',
      expect.objectContaining({ subject, lifetime: 'stream' })
    );
  });

  it('reports downloads the network policy blocks', async () => {
    mocks.gatewayFetch.mockRejectedValue(new EgressGatewayRefusedError('denied'));

    let response = await request();
    let body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('integration_attachment_egress_blocked');
    expect(body).not.toContain('LIVE-TOKEN');
  });
});
