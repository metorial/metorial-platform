import { isServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  addRemoteErrorCheck,
  dbMock,
  lockState,
  oauthUtilsMock,
  remoteConnectionServiceMock,
  secretServiceMock,
  serverEventServiceMock
} = vi.hoisted(() => ({
  addRemoteErrorCheck: vi.fn(),
  dbMock: {
    remoteOAuthConnectionAuthToken: {
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    remoteOAuthConnectionAuthTokenError: { create: vi.fn() }
  },
  lockState: { tail: Promise.resolve() as Promise<unknown> },
  oauthUtilsMock: { refreshAccessToken: vi.fn() },
  remoteConnectionServiceMock: { DANGEROUSLY_getCredentials: vi.fn() },
  secretServiceMock: {
    DANGEROUSLY_decryptSecret: vi.fn(),
    DANGEROUSLY_updateSecret: vi.fn()
  },
  serverEventServiceMock: { recordServerAuthConfigEvent: vi.fn() }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: <T>(_key: string, fn: () => Promise<T>) => {
      let result = lockState.tail.then(fn);
      lockState.tail = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    }
  })
}));

vi.mock('../../../db', () => ({ db: dbMock }));
vi.mock('../../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../../../id', () => ({ getId: () => ({ oid: 99n, id: 'error_test' }) }));
vi.mock('../../../lib/oauth/oauthUtils', () => ({ OAuthUtils: oauthUtilsMock }));
vi.mock('../../../queues/oauth/remoteErrorCheck', () => ({ addRemoteErrorCheck }));
vi.mock('../../secret', () => ({ secretService: secretServiceMock }));
vi.mock('../serverEvent', () => ({ serverEventService: serverEventServiceMock }));
vi.mock('./connection', () => ({
  remoteOAuthConnectionService: remoteConnectionServiceMock
}));

import { remoteAuthTokenService } from './authToken';

let tenant = { oid: 1n, id: 'tenant_test' } as any;
let authConfig = { oid: 2n, id: 'auth_test', tenantOid: 1n } as any;
let currentSecret: { accessToken: string; refreshToken: string };
let connection = {
  oid: 3n,
  id: 'oauth_connection_test',
  config: {
    config: {
      authorization_endpoint: 'https://provider.test/authorize',
      token_endpoint: 'https://provider.test/token'
    }
  }
} as any;

let createToken = (overrides: Record<string, unknown> = {}) => ({
  oid: 4n,
  id: 'token_test',
  source: 'oauth',
  secretOid: 5n,
  connection,
  expiresAt: new Date(Date.now() - 60_000),
  refreshedAt: null,
  lastUsedAt: new Date(),
  firstErrorAt: null,
  lastErrorAt: null,
  errorDisabledAt: null,
  errorCount: 0,
  tokenType: 'Bearer',
  idToken: null,
  scope: null,
  errors: [],
  ...overrides
});

let useToken = () =>
  remoteAuthTokenService.useAuthToken({
    tenant,
    remoteOAuthConnectionAuthTokenOid: 4n,
    serverAuthConfig: authConfig,
    serverConnectionId: 'server_connection_test'
  });

beforeEach(() => {
  vi.clearAllMocks();
  lockState.tail = Promise.resolve();
  currentSecret = {
    accessToken: 'old-access-token',
    refreshToken: 'refresh-token'
  };
  secretServiceMock.DANGEROUSLY_decryptSecret.mockImplementation(async () => currentSecret);
  secretServiceMock.DANGEROUSLY_updateSecret.mockImplementation(async ({ secretData }) => {
    currentSecret = { ...secretData };
  });
  remoteConnectionServiceMock.DANGEROUSLY_getCredentials.mockResolvedValue({
    clientId: 'client-id',
    clientSecret: 'client-secret'
  });
  serverEventServiceMock.recordServerAuthConfigEvent.mockResolvedValue(undefined);
  addRemoteErrorCheck.mockResolvedValue(undefined);
});

describe('remoteAuthTokenService', () => {
  it('stores and permanently suppresses a provider credential rejection', async () => {
    let token = createToken();
    dbMock.remoteOAuthConnectionAuthToken.findFirstOrThrow.mockResolvedValue(token);
    dbMock.remoteOAuthConnectionAuthToken.update.mockResolvedValue(token);
    dbMock.remoteOAuthConnectionAuthTokenError.create.mockResolvedValue({});
    oauthUtilsMock.refreshAccessToken.mockResolvedValue({
      ok: false,
      error: {
        status: 400,
        oauthCode: 'invalid_grant',
        isTransient: false,
        retryAfterMs: null
      },
      message: 'OAuth token refresh failed (HTTP 400, OAuth error invalid_grant)'
    });

    let error = await useToken().catch(error => error);

    expect(isServiceError(error)).toBe(true);
    expect(error.data.code).toBe('auth_token_refresh_failed');
    expect(error.data.message).toContain('Re-authenticate this connection');
    expect(dbMock.remoteOAuthConnectionAuthToken.update).toHaveBeenCalledWith({
      where: { oid: 4n },
      data: expect.objectContaining({ errorDisabledAt: expect.any(Date) })
    });
    expect(dbMock.remoteOAuthConnectionAuthTokenError.create).toHaveBeenCalledTimes(1);
    expect(serverEventServiceMock.recordServerAuthConfigEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        serverConnectionId: 'server_connection_test',
        payload: expect.objectContaining({
          upstreamStatus: 400,
          upstreamOAuthCode: 'invalid_grant',
          retryable: false,
          replayed: false
        })
      })
    );
  });

  it('classifies invalid OAuth client credentials separately from an expired grant', async () => {
    let token = createToken();
    dbMock.remoteOAuthConnectionAuthToken.findFirstOrThrow.mockResolvedValue(token);
    dbMock.remoteOAuthConnectionAuthToken.update.mockResolvedValue(token);
    dbMock.remoteOAuthConnectionAuthTokenError.create.mockResolvedValue({});
    oauthUtilsMock.refreshAccessToken.mockResolvedValue({
      ok: false,
      error: {
        status: 401,
        oauthCode: 'invalid_client',
        isTransient: false,
        retryAfterMs: null
      },
      message: 'OAuth token refresh failed (HTTP 401, OAuth error invalid_client)'
    });

    let error = await useToken().catch(error => error);

    expect(error.data.code).toBe('invalid_credentials');
    expect(error.data.message).toContain('Configure valid OAuth client credentials');
  });

  it('replays a cached permanent failure without contacting the provider again', async () => {
    let token = createToken({
      lastErrorAt: new Date(),
      errorDisabledAt: new Date(),
      errorCount: 1,
      errors: [
        {
          errorCode: 'auth_token_refresh_failed',
          errorMessage:
            'OAuth token refresh failed (HTTP 400, OAuth error invalid_grant). Re-authenticate this connection to continue.'
        }
      ]
    });
    dbMock.remoteOAuthConnectionAuthToken.findFirstOrThrow.mockResolvedValue(token);

    let error = await useToken().catch(error => error);

    expect(error.data.code).toBe('auth_token_refresh_failed');
    expect(oauthUtilsMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(dbMock.remoteOAuthConnectionAuthTokenError.create).not.toHaveBeenCalled();
    expect(serverEventServiceMock.recordServerAuthConfigEvent).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ replayed: true }) })
    );
  });

  it('replays a recent transient failure during the cooldown', async () => {
    let token = createToken({
      lastErrorAt: new Date(),
      errorCount: 1,
      errors: [
        {
          errorCode: 'connection_error',
          errorMessage: 'OAuth token refresh failed (HTTP 503). Try again shortly.'
        }
      ]
    });
    dbMock.remoteOAuthConnectionAuthToken.findFirstOrThrow.mockResolvedValue(token);

    let error = await useToken().catch(error => error);

    expect(error.data.code).toBe('connection_error');
    expect(oauthUtilsMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(serverEventServiceMock.recordServerAuthConfigEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ retryable: true, replayed: true })
      })
    );
  });

  it('retries after the transient cooldown and clears the failure state', async () => {
    let token = createToken({
      firstErrorAt: new Date(Date.now() - 120_000),
      lastErrorAt: new Date(Date.now() - 61_000),
      errorCount: 1,
      errors: [
        {
          errorCode: 'connection_error',
          errorMessage: 'OAuth token refresh failed (HTTP 503). Try again shortly.'
        }
      ]
    });
    let refreshedToken = createToken({
      expiresAt: new Date(Date.now() + 3_600_000),
      refreshedAt: new Date()
    });
    dbMock.remoteOAuthConnectionAuthToken.findFirstOrThrow.mockResolvedValue(token);
    dbMock.remoteOAuthConnectionAuthToken.update.mockResolvedValue(refreshedToken);
    oauthUtilsMock.refreshAccessToken.mockResolvedValue({
      ok: true,
      response: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600
      }
    });

    let result = await useToken();

    expect(result.didRefresh).toBe(true);
    expect(oauthUtilsMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(dbMock.remoteOAuthConnectionAuthToken.update).toHaveBeenCalledWith({
      where: { oid: 4n },
      data: expect.objectContaining({
        firstErrorAt: null,
        lastErrorAt: null,
        errorCount: 0,
        errorDisabledAt: null
      })
    });
  });

  it('serializes concurrent refreshes and reuses the refreshed token', async () => {
    let currentToken = createToken();
    dbMock.remoteOAuthConnectionAuthToken.findFirstOrThrow.mockImplementation(async () => ({
      ...currentToken
    }));
    dbMock.remoteOAuthConnectionAuthToken.update.mockImplementation(async ({ data }) => {
      currentToken = { ...currentToken, ...data, errors: [] } as any;
      return currentToken;
    });
    oauthUtilsMock.refreshAccessToken.mockResolvedValue({
      ok: true,
      response: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600
      }
    });

    let results = await Promise.all([useToken(), useToken()]);

    expect(oauthUtilsMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(results.map(result => result.didRefresh).sort()).toEqual([false, true]);
    expect(results.every(result => result.accessToken === 'new-access-token')).toBe(true);
  });
});
