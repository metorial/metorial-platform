import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  authorizationCreate: vi.fn(),
  authorizationFindFirst: vi.fn(),
  authorizationUpdateMany: vi.fn(),
  grantCreate: vi.fn(),
  getClientForAuthorization: vi.fn(),
  hasCapacity: vi.fn(),
  fabricFire: vi.fn(),
  withCapacity: vi.fn(async (_server: unknown, fn: () => Promise<unknown>) => await fn())
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    publicMcpServerAuthorization: {
      create: mocks.authorizationCreate,
      findFirst: mocks.authorizationFindFirst,
      updateMany: mocks.authorizationUpdateMany
    },
    publicMcpServerGrant: { create: mocks.grantCreate }
  };

  return {
    db,
    getId: vi.fn((prefix: string) => ({ oid: 99n, id: `${prefix}_1` })),
    withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) => run(db))
  };
});

vi.mock('@metorial-subspace/module-auth', () => ({
  providerSetupSessionService: { createProviderSetupSessionInternal: vi.fn() },
  getProviderSetupSessionUrl: vi.fn(
    (session: { id: string; clientSecret: string }) =>
      `https://integrations.metorial.com/setup-session/${session.id}?client_secret=${session.clientSecret}`
  )
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getSubspaceSystemProviderEventBase: vi.fn(async () => ({})),
  metorialDb: { instance: { findUnique: vi.fn() } }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fabricFire }
}));

vi.mock('../env', () => ({
  env: { service: { INTEGRATIONS_UI_URL: 'https://integrations.metorial.com' } }
}));

vi.mock('../lib/capacityLock', () => ({
  withPublicMcpGrantCapacity: mocks.withCapacity
}));

vi.mock('../internal/rateLimit', () => ({
  assertPublicMcpRateLimit: vi.fn(async () => {})
}));

vi.mock('../lib/secrets', () => ({
  generateSecret: (prefix: string) => `${prefix}secret`,
  hashSecret: async (value: string) => `hash:${value}`,
  secretsEqual: (a: string, b: string) => a === b
}));

vi.mock('./publicMcpServerClient', () => ({
  publicMcpServerClientService: {
    getClientForAuthorization: mocks.getClientForAuthorization
  }
}));

vi.mock('./publicMcpServerGrant', () => ({
  publicMcpServerGrantService: { hasCapacity: mocks.hasCapacity }
}));

import { publicMcpServerAuthorizationService } from './publicMcpServerAuthorization';

let redirectUri = 'http://127.0.0.1:3000/callback';
let baseUrl = 'https://mcp.metorial.com/acme';

let route = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 1n,
    instanceOid: 2n,
    projectOid: 3n,
    tenantOid: 4n,
    environmentOid: 5n,
    solutionOid: 6n,
    deploymentOid: 7n,
    status: 'active',
    name: 'Acme',
    ...overrides
  }) as any;

let authorize = (query: Record<string, unknown> = {}, routeOverrides = {}) =>
  publicMcpServerAuthorizationService.authorize({
    route: route(routeOverrides),
    baseUrl,
    query: {
      clientId: 'client_1',
      redirectUri,
      responseType: 'code',
      codeChallenge: 'c'.repeat(43),
      codeChallengeMethod: 'S256',
      state: 'xyz',
      scope: null,
      resource: null,
      ...query
    } as any,
    context: { ip: '127.0.0.1', ua: null }
  });

let pendingAuthorization = (overrides: Record<string, unknown> = {}) => ({
  oid: 70n,
  id: 'pmsa_1',
  status: 'setup',
  redirectUri,
  state: 'xyz',
  baseUrl,
  clientOid: 5n,
  browserBindingHash: 'hash:nonce',
  expiresAt: new Date(Date.now() + 60_000),
  setupSession: {
    status: 'completed',
    ownerPublicMcpServerOid: 1n,
    configOid: 10n,
    authConfigOid: 11n
  },
  ...overrides
});

let complete = (d: { bindingNonce: string | null; deny?: boolean }, routeOverrides = {}) =>
  publicMcpServerAuthorizationService.complete({
    route: route(routeOverrides),
    authorizationId: 'pmsa_1',
    context: { ip: '127.0.0.1', ua: null },
    ...d
  });

let oauthError = (error: string, extra: Record<string, unknown> = {}) =>
  expect.objectContaining({ error, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClientForAuthorization.mockResolvedValue({
    oid: 5n,
    clientName: 'Client',
    redirectUris: [redirectUri]
  });
  mocks.hasCapacity.mockResolvedValue(true);
  mocks.authorizationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.grantCreate.mockImplementation(async ({ data }) => data);
});

describe('authorize', () => {
  it('rejects an unregistered redirect URI without redirecting to it', async () => {
    let error = await authorize({ redirectUri: 'https://evil.example/cb' }).catch(e => e);

    expect(error).toEqual(oauthError('invalid_request'));
    expect(error.opts.redirectUri).toBeUndefined();
    expect(mocks.authorizationCreate).not.toHaveBeenCalled();
  });

  it('requires S256 PKCE', async () => {
    await expect(authorize({ codeChallengeMethod: 'plain' })).rejects.toEqual(
      oauthError('invalid_request', { opts: expect.objectContaining({ redirectUri }) })
    );
    await expect(authorize({ codeChallenge: null })).rejects.toEqual(
      oauthError('invalid_request')
    );
    expect(mocks.authorizationCreate).not.toHaveBeenCalled();
  });

  it('rejects foreign resources and scopes', async () => {
    await expect(authorize({ resource: 'https://mcp.metorial.com/other' })).rejects.toEqual(
      oauthError('invalid_target')
    );
    await expect(authorize({ scope: 'mcp admin' })).rejects.toEqual(
      oauthError('invalid_scope')
    );
  });

  it('refuses new authorizations on a disabled server', async () => {
    await expect(authorize({}, { status: 'disabled' })).rejects.toEqual(
      oauthError('temporarily_unavailable')
    );
    expect(mocks.authorizationCreate).not.toHaveBeenCalled();
  });

  it('refuses new authorizations once the server is at capacity', async () => {
    mocks.hasCapacity.mockResolvedValue(false);

    await expect(authorize()).rejects.toEqual(oauthError('access_denied'));
    expect(mocks.authorizationCreate).not.toHaveBeenCalled();
  });
});

describe('complete', () => {
  it('issues a code for the browser that started the flow', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(pendingAuthorization());

    let result = await complete({ bindingNonce: 'nonce' });

    let url = new URL(result.url);
    expect(`${url.origin}${url.pathname}`).toBe(redirectUri);
    expect(url.searchParams.get('code')).toBe('metorial_pmac_secret');
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(url.searchParams.get('iss')).toBe(baseUrl);
    expect(mocks.grantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending_exchange', publicMcpServerOid: 1n })
      })
    );
  });

  it('rejects a missing binding cookie', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(pendingAuthorization());

    await expect(complete({ bindingNonce: null })).rejects.toEqual(
      oauthError('access_denied', { opts: { status: 403 } })
    );
    expect(mocks.grantCreate).not.toHaveBeenCalled();
  });

  it('rejects a binding cookie from another browser', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(pendingAuthorization());

    await expect(complete({ bindingNonce: 'other' })).rejects.toEqual(
      oauthError('access_denied', { opts: { status: 403 } })
    );
    expect(mocks.authorizationUpdateMany).not.toHaveBeenCalled();
  });

  it('only finds authorizations of the requested server', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(null);

    await expect(complete({ bindingNonce: 'nonce' })).rejects.toEqual(
      oauthError('invalid_request')
    );
    expect(mocks.authorizationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pmsa_1', publicMcpServerOid: 1n } })
    );
  });

  it('rejects setup sessions owned by another server', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(
      pendingAuthorization({
        setupSession: { status: 'completed', ownerPublicMcpServerOid: 9n }
      })
    );

    await expect(complete({ bindingNonce: 'nonce' })).rejects.toEqual(
      oauthError('server_error')
    );
    expect(mocks.grantCreate).not.toHaveBeenCalled();
  });

  it('does not issue a second code for a completed authorization', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(
      pendingAuthorization({ status: 'code_issued' })
    );
    await expect(complete({ bindingNonce: 'nonce' })).rejects.toEqual(
      oauthError('invalid_request')
    );

    mocks.authorizationFindFirst.mockResolvedValue(pendingAuthorization());
    mocks.authorizationUpdateMany.mockResolvedValue({ count: 0 });
    await expect(complete({ bindingNonce: 'nonce' })).rejects.toEqual(
      oauthError('invalid_request')
    );

    expect(mocks.fabricFire).not.toHaveBeenCalledWith(
      'provider.public_mcp_grant.created:after',
      expect.anything()
    );
  });

  it('re-checks capacity under the per-server lock before creating the grant', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(pendingAuthorization());
    mocks.hasCapacity.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(complete({ bindingNonce: 'nonce' })).rejects.toEqual(
      oauthError('access_denied')
    );

    expect(mocks.withCapacity).toHaveBeenCalledWith(
      expect.objectContaining({ oid: 1n }),
      expect.any(Function)
    );
    expect(mocks.hasCapacity).toHaveBeenCalledTimes(2);
    expect(mocks.grantCreate).not.toHaveBeenCalled();
    expect(mocks.authorizationUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses to issue a code on a disabled server', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(pendingAuthorization());

    await expect(complete({ bindingNonce: 'nonce' }, { status: 'disabled' })).rejects.toEqual(
      oauthError('temporarily_unavailable')
    );
    expect(mocks.grantCreate).not.toHaveBeenCalled();
  });

  it('records a denial and reports it to the client', async () => {
    mocks.authorizationFindFirst.mockResolvedValue(pendingAuthorization());

    await expect(complete({ bindingNonce: 'nonce', deny: true })).rejects.toEqual(
      oauthError('access_denied', { opts: expect.objectContaining({ redirectUri }) })
    );
    expect(mocks.authorizationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'denied' }) })
    );
  });
});
