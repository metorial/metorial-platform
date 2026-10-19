import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  authorizationFindUnique: vi.fn(),
  authorizationUpdateMany: vi.fn(),
  tokenFindUnique: vi.fn(),
  tokenUpdateMany: vi.fn(),
  tokenCreate: vi.fn(),
  tokenUpdate: vi.fn(),
  grantUpdateMany: vi.fn(),
  authenticateClient: vi.fn(),
  revokeGrantInternal: vi.fn()
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
      findUnique: mocks.authorizationFindUnique,
      updateMany: mocks.authorizationUpdateMany
    },
    publicMcpServerToken: {
      findUnique: mocks.tokenFindUnique,
      updateMany: mocks.tokenUpdateMany,
      create: mocks.tokenCreate,
      update: mocks.tokenUpdate
    },
    publicMcpServerGrant: {
      updateMany: mocks.grantUpdateMany
    }
  };

  return {
    db,
    getId: vi.fn((prefix: string) => ({ oid: 99n, id: `${prefix}_1` })),
    withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) => run(db))
  };
});

vi.mock('@metorial/api-keys', () => ({
  PUBLIC_MCP_ACCESS_TOKEN_PREFIX: 'metorial_pma_',
  generatePublicMcpToken: (type: 'access' | 'refresh') =>
    `${type == 'access' ? 'metorial_pma_' : 'metorial_pmr_'}${Math.random().toString(36).slice(2)}`,
  getPublicMcpTokenType: (token: string) =>
    token.startsWith('metorial_pma_')
      ? 'access'
      : token.startsWith('metorial_pmr_')
        ? 'refresh'
        : null
}));

vi.mock('@metorial/consumer-oauth-utils', () => ({
  createCodeChallenge: async (verifier: string) =>
    createHash('sha256').update(verifier).digest('base64url')
}));

vi.mock('../internal/rateLimit', () => ({
  assertPublicMcpRateLimit: vi.fn(async () => {})
}));

vi.mock('../lib/secrets', () => ({
  hashSecret: async (value: string) => `hash:${value}`,
  secretsEqual: (a: string, b: string) => a === b
}));

vi.mock('./publicMcpServerClient', () => ({
  publicMcpServerClientService: { authenticateClient: mocks.authenticateClient }
}));

vi.mock('./publicMcpServerGrant', () => ({
  publicMcpServerGrantService: { revokeGrantInternal: mocks.revokeGrantInternal }
}));

import { publicMcpServerTokenService } from './publicMcpServerToken';

let verifier = 'v'.repeat(43);
let challenge = createHash('sha256').update(verifier).digest('base64url');
let redirectUri = 'http://127.0.0.1:3000/callback';
let baseUrl = 'https://mcp.metorial.com/acme';

let route = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 1n,
    instanceOid: 2n,
    status: 'active',
    grantIdleExpirySeconds: 3600,
    accessTokenTtlSeconds: 600,
    refreshTokenTtlSeconds: 86_400,
    ...overrides
  }) as any;

let grant = (overrides: Record<string, unknown> = {}) => ({
  oid: 50n,
  publicMcpServerOid: 1n,
  clientOid: 5n,
  instanceOid: 2n,
  projectOid: 3n,
  status: 'active',
  expiresAt: new Date(Date.now() + 60_000),
  ...overrides
});

let authorization = (overrides: Record<string, unknown> = {}) => ({
  oid: 70n,
  publicMcpServerOid: 1n,
  clientOid: 5n,
  status: 'code_issued',
  codeUsedAt: null,
  codeExpiresAt: new Date(Date.now() + 60_000),
  redirectUri,
  codeChallenge: challenge,
  grant: grant({ status: 'pending_exchange' }),
  ...overrides
});

let refreshToken = (overrides: Record<string, unknown> = {}) => ({
  oid: 80n,
  type: 'refresh',
  usedAt: null,
  revokedAt: null,
  familyId: 'family_1',
  grantOid: 50n,
  expiresAt: new Date(Date.now() + 60_000),
  grant: grant(),
  ...overrides
});

let exchange = (
  input: Record<string, unknown>,
  routeOverrides: Record<string, unknown> = {}
) =>
  publicMcpServerTokenService.exchange({
    route: route(routeOverrides),
    validBaseUrls: [baseUrl],
    input: {
      grantType: null,
      code: null,
      redirectUri: null,
      codeVerifier: null,
      refreshToken: null,
      resource: null,
      ...input
    } as any,
    credentials: { clientId: 'client_1', clientSecret: null, method: 'none' },
    context: { ip: '127.0.0.1', ua: null }
  });

let exchangeCode = (input: Record<string, unknown> = {}, routeOverrides = {}) =>
  exchange(
    {
      grantType: 'authorization_code',
      code: 'metorial_pmac_code',
      redirectUri,
      codeVerifier: verifier,
      ...input
    },
    routeOverrides
  );

let exchangeRefresh = () =>
  exchange({ grantType: 'refresh_token', refreshToken: 'metorial_pmr_refresh' });

let oauthError = (error: string) => expect.objectContaining({ error });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateClient.mockResolvedValue({ oid: 5n });
  mocks.authorizationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.grantUpdateMany.mockResolvedValue({ count: 1 });
  mocks.tokenUpdateMany.mockResolvedValue({ count: 1 });
  mocks.tokenCreate.mockImplementation(async ({ data }) => ({ ...data, oid: 90n }));
  mocks.tokenUpdate.mockResolvedValue({});
});

describe('authorization code exchange', () => {
  it('issues tokens for a valid code and PKCE verifier', async () => {
    mocks.authorizationFindUnique.mockResolvedValue(authorization());

    let result = await exchangeCode({ resource: `${baseUrl}/` });

    expect(result).toMatchObject({ token_type: 'Bearer', expires_in: 600 });
    expect(result.access_token.startsWith('metorial_pma_')).toBe(true);
    expect(result.refresh_token.startsWith('metorial_pmr_')).toBe(true);
    expect(mocks.authorizationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorizationCodeHash: 'hash:metorial_pmac_code' } })
    );
    expect(mocks.grantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 50n, status: 'pending_exchange' } })
    );
  });

  it('rejects a wrong PKCE verifier', async () => {
    mocks.authorizationFindUnique.mockResolvedValue(authorization());

    await expect(exchangeCode({ codeVerifier: 'w'.repeat(43) })).rejects.toEqual(
      oauthError('invalid_grant')
    );
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it('requires a well-formed code verifier', async () => {
    await expect(exchangeCode({ codeVerifier: 'short' })).rejects.toEqual(
      oauthError('invalid_request')
    );
    expect(mocks.authorizationFindUnique).not.toHaveBeenCalled();
  });

  it('rejects a redirect URI that differs from the authorization request', async () => {
    mocks.authorizationFindUnique.mockResolvedValue(authorization());

    await expect(exchangeCode({ redirectUri: 'https://evil.example/cb' })).rejects.toEqual(
      oauthError('invalid_grant')
    );
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it('revokes the grant when a code is replayed', async () => {
    let auth = authorization({ status: 'exchanged', codeUsedAt: new Date() });
    mocks.authorizationFindUnique.mockResolvedValue(auth);

    await expect(exchangeCode()).rejects.toEqual(oauthError('invalid_grant'));
    expect(mocks.revokeGrantInternal).toHaveBeenCalledWith({
      grant: auth.grant,
      reason: 'authorization_code_reuse'
    });
  });

  it('rejects a concurrent second exchange of the same code', async () => {
    mocks.authorizationFindUnique.mockResolvedValue(authorization());
    mocks.authorizationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(exchangeCode()).rejects.toEqual(oauthError('invalid_grant'));
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it('rejects codes issued for another server or client', async () => {
    mocks.authorizationFindUnique.mockResolvedValue(authorization({ publicMcpServerOid: 9n }));
    await expect(exchangeCode()).rejects.toEqual(oauthError('invalid_grant'));

    mocks.authorizationFindUnique.mockResolvedValue(authorization({ clientOid: 6n }));
    await expect(exchangeCode()).rejects.toEqual(oauthError('invalid_grant'));

    expect(mocks.revokeGrantInternal).not.toHaveBeenCalled();
  });

  it('rejects expired codes', async () => {
    mocks.authorizationFindUnique.mockResolvedValue(
      authorization({ codeExpiresAt: new Date(Date.now() - 1) })
    );

    await expect(exchangeCode()).rejects.toEqual(oauthError('invalid_grant'));
  });

  it('rejects a resource that does not identify the server', async () => {
    await expect(exchangeCode({ resource: 'https://mcp.metorial.com/other' })).rejects.toEqual(
      oauthError('invalid_target')
    );
  });

  it('refuses to issue tokens for a disabled server', async () => {
    mocks.authorizationFindUnique.mockResolvedValue(authorization());

    await expect(exchangeCode({}, { status: 'disabled' })).rejects.toEqual(
      oauthError('temporarily_unavailable')
    );
    expect(mocks.authorizationFindUnique).not.toHaveBeenCalled();
  });
});

describe('refresh token exchange', () => {
  it('rotates a valid refresh token', async () => {
    mocks.tokenFindUnique.mockResolvedValue(refreshToken());

    let result = await exchangeRefresh();

    expect(result.refresh_token.startsWith('metorial_pmr_')).toBe(true);
    expect(mocks.tokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 80n, usedAt: null, revokedAt: null } })
    );
    expect(mocks.tokenUpdate).toHaveBeenCalledWith({
      where: { oid: 80n },
      data: { replacedByOid: 90n }
    });
  });

  it('revokes the grant when a used refresh token is presented again', async () => {
    let token = refreshToken({ usedAt: new Date() });
    mocks.tokenFindUnique.mockResolvedValue(token);

    await expect(exchangeRefresh()).rejects.toEqual(oauthError('invalid_grant'));
    expect(mocks.revokeGrantInternal).toHaveBeenCalledWith({
      grant: token.grant,
      reason: 'refresh_token_reuse'
    });
  });

  it('treats losing a concurrent rotation race as reuse', async () => {
    mocks.tokenFindUnique.mockResolvedValue(refreshToken());
    mocks.tokenUpdateMany.mockResolvedValue({ count: 0 });

    await expect(exchangeRefresh()).rejects.toEqual(oauthError('invalid_grant'));
    expect(mocks.revokeGrantInternal).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'refresh_token_reuse' })
    );
  });

  it('rejects refresh tokens of another server or client', async () => {
    mocks.tokenFindUnique.mockResolvedValue(
      refreshToken({ grant: grant({ publicMcpServerOid: 9n }) })
    );
    await expect(exchangeRefresh()).rejects.toEqual(oauthError('invalid_grant'));

    mocks.tokenFindUnique.mockResolvedValue(refreshToken({ grant: grant({ clientOid: 6n }) }));
    await expect(exchangeRefresh()).rejects.toEqual(oauthError('invalid_grant'));

    expect(mocks.revokeGrantInternal).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens of a revoked grant', async () => {
    mocks.tokenFindUnique.mockResolvedValue(
      refreshToken({ grant: grant({ status: 'revoked' }) })
    );

    await expect(exchangeRefresh()).rejects.toEqual(oauthError('invalid_grant'));
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it('rejects access tokens presented as refresh tokens', async () => {
    await expect(
      exchange({ grantType: 'refresh_token', refreshToken: 'metorial_pma_access' })
    ).rejects.toEqual(oauthError('invalid_grant'));
    expect(mocks.tokenFindUnique).not.toHaveBeenCalled();
  });
});

describe('access token authentication', () => {
  let accessToken = (overrides: Record<string, unknown> = {}) => ({
    type: 'access',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    grant: grant(),
    ...overrides
  });

  let authenticate = (token: string | null, routeOverrides: Record<string, unknown> = {}) =>
    publicMcpServerTokenService.authenticateAccessToken({
      route: route(routeOverrides),
      token
    });

  it('returns the grant for a valid token', async () => {
    let token = accessToken();
    mocks.tokenFindUnique.mockResolvedValue(token);

    await expect(authenticate('metorial_pma_valid')).resolves.toBe(token.grant);
  });

  it('rejects missing or foreign tokens without a lookup', async () => {
    await expect(authenticate(null)).rejects.toEqual(oauthError('invalid_token'));
    await expect(authenticate('metorial_sk_123')).rejects.toEqual(oauthError('invalid_token'));
    expect(mocks.tokenFindUnique).not.toHaveBeenCalled();
  });

  it('rejects a token issued for another server', async () => {
    mocks.tokenFindUnique.mockResolvedValue(
      accessToken({ grant: grant({ publicMcpServerOid: 9n }) })
    );
    await expect(authenticate('metorial_pma_valid')).rejects.toEqual(
      oauthError('invalid_token')
    );

    mocks.tokenFindUnique.mockResolvedValue(
      accessToken({ grant: grant({ instanceOid: 8n }) })
    );
    await expect(authenticate('metorial_pma_valid')).rejects.toEqual(
      oauthError('invalid_token')
    );
  });

  it('rejects revoked, expired, and refresh tokens', async () => {
    for (let token of [
      accessToken({ revokedAt: new Date() }),
      accessToken({ expiresAt: new Date(Date.now() - 1) }),
      accessToken({ type: 'refresh' }),
      accessToken({ grant: grant({ status: 'revoked' }) })
    ]) {
      mocks.tokenFindUnique.mockResolvedValue(token);
      await expect(authenticate('metorial_pma_valid')).rejects.toEqual(
        oauthError('invalid_token')
      );
    }
  });

  it('rejects valid tokens while the server is disabled', async () => {
    mocks.tokenFindUnique.mockResolvedValue(accessToken());

    await expect(authenticate('metorial_pma_valid', { status: 'disabled' })).rejects.toEqual(
      oauthError('invalid_token')
    );
  });
});
