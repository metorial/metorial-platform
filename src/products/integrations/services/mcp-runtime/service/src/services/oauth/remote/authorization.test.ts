import { badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  defaultRedirectUri,
  dbMock,
  oauthUtilsMock,
  remoteOAuthConnectionServiceMock,
  secretServiceMock,
  serverEventServiceMock
} = vi.hoisted(() => ({
  defaultRedirectUri: 'https://shuttle.example.com/shuttle-oauth/callback',
  dbMock: {
    remoteOAuthConnection: {
      findFirstOrThrow: vi.fn()
    },
    remoteOAuthConnectionSetup: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    remoteOAuthConnectionProfile: { upsert: vi.fn() },
    remoteOAuthConnectionAuthToken: { create: vi.fn() },
    serverAuthConfig: { create: vi.fn() },
    serverOAuthSetup: { update: vi.fn(), updateMany: vi.fn() }
  },
  oauthUtilsMock: {
    generateCodeVerifier: vi.fn(),
    generateCodeChallenge: vi.fn(),
    buildAuthorizationUrl: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    getUserProfile: vi.fn()
  },
  remoteOAuthConnectionServiceMock: {
    DANGEROUSLY_getCredentials: vi.fn()
  },
  secretServiceMock: { createSecret: vi.fn() },
  serverEventServiceMock: { recordServerOAuthSetupEvent: vi.fn() }
}));

vi.mock('../../../config', () => ({
  oauthCallbackUrl: defaultRedirectUri
}));

vi.mock('../../../db', () => ({
  db: dbMock
}));

vi.mock('../../../id', () => ({
  getId: () => ({ oid: 1n, id: 'test_id' })
}));

vi.mock('../../../lib/oauth/oauthUtils', () => ({
  OAuthUtils: oauthUtilsMock
}));

vi.mock('../../secret', () => ({
  secretService: secretServiceMock
}));

vi.mock('../serverEvent', () => ({
  serverEventService: serverEventServiceMock
}));

vi.mock('./connection', () => ({
  remoteOAuthConnectionService: remoteOAuthConnectionServiceMock
}));

import { getRemoteOAuthRedirectUri, remoteOauthAuthorizationService } from './authorization';

beforeEach(() => {
  vi.clearAllMocks();

  oauthUtilsMock.generateCodeVerifier.mockReturnValue('test-code-verifier');
  oauthUtilsMock.generateCodeChallenge.mockResolvedValue('test-code-challenge');
  oauthUtilsMock.buildAuthorizationUrl.mockReturnValue('https://provider.example.com/auth');

  remoteOAuthConnectionServiceMock.DANGEROUSLY_getCredentials.mockResolvedValue({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
  });
  serverEventServiceMock.recordServerOAuthSetupEvent.mockResolvedValue(undefined);
});

describe('getRemoteOAuthRedirectUri', () => {
  it('uses the callback override for manually registered connections', () => {
    let callbackUrlOverride = 'https://subspace.example.com/oauth-callback/test-provider';

    let redirectUri = getRemoteOAuthRedirectUri({
      connection: { registrationOid: null },
      serverOAuthSetup: { callbackUrlOverride }
    });

    expect(redirectUri).toBe(callbackUrlOverride);
  });

  it('uses the default callback URL when no override is present', () => {
    let redirectUri = getRemoteOAuthRedirectUri({
      connection: { registrationOid: null },
      serverOAuthSetup: { callbackUrlOverride: null }
    });

    expect(redirectUri).toBe(defaultRedirectUri);
  });

  it('uses the default callback URL for auto-registered connections', () => {
    let redirectUri = getRemoteOAuthRedirectUri({
      connection: { registrationOid: 1n },
      serverOAuthSetup: {
        callbackUrlOverride: 'https://subspace.example.com/oauth-callback/test-provider'
      }
    });

    expect(redirectUri).toBe(defaultRedirectUri);
  });
});

describe('remoteOauthAuthorizationService.startAuthorization', () => {
  it('uses the explicit server OAuth setup when the inverse relation is not linked yet', async () => {
    let callbackUrlOverride = 'https://subspace.example.com/oauth-callback/test-provider';
    let tenant = { oid: 11n };
    let connection = {
      oid: 12n,
      tenantOid: tenant.oid,
      registrationOid: null,
      status: 'active',
      discoveryStatus: 'succeeded',
      config: {
        scopes: ['repo'],
        config: {
          authorization_endpoint: 'https://provider.example.com/authorize',
          token_endpoint: 'https://provider.example.com/token',
          code_challenge_methods_supported: ['S256']
        }
      }
    };
    let createdSetup = {
      oid: 13n,
      stateIdentifier: 'test-state',
      codeVerifier: 'test-code-verifier',
      tenant,
      serverOAuthSetup: null
    };

    dbMock.remoteOAuthConnectionSetup.create.mockResolvedValue(createdSetup);

    let result = await remoteOauthAuthorizationService.startAuthorization({
      connection: connection as any,
      serverOAuthSetup: { callbackUrlOverride }
    });

    expect(result.redirectUrl).toBe('https://provider.example.com/auth');
    expect(oauthUtilsMock.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'test-client-id',
        redirectUri: callbackUrlOverride,
        scopes: ['repo'],
        state: 'test-state',
        codeChallenge: 'test-code-challenge'
      })
    );
  });
});

describe('remoteOauthAuthorizationService.resumeAuthorization', () => {
  it('rebuilds the redirect with the existing state and PKCE verifier', async () => {
    let connection = {
      oid: 12n,
      registrationOid: null,
      status: 'active',
      discoveryStatus: 'succeeded',
      config: {
        scopes: ['repo'],
        config: {
          authorization_endpoint: 'https://provider.example.com/authorize',
          token_endpoint: 'https://provider.example.com/token',
          code_challenge_methods_supported: ['S256']
        }
      }
    };
    let setup = {
      oid: 13n,
      status: 'pending',
      stateIdentifier: 'existing-state',
      codeVerifier: 'existing-verifier',
      tenant: { oid: 11n }
    };

    let result = await remoteOauthAuthorizationService.resumeAuthorization({
      connection: connection as any,
      setup: setup as any,
      serverOAuthSetup: {
        callbackUrlOverride: 'https://subspace.example.com/oauth-callback/test-provider'
      }
    });

    expect(result.redirectUrl).toBe('https://provider.example.com/auth');
    expect(oauthUtilsMock.generateCodeChallenge).toHaveBeenCalledWith('existing-verifier');
    expect(oauthUtilsMock.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'existing-state',
        codeChallenge: 'test-code-challenge'
      })
    );
    expect(dbMock.remoteOAuthConnectionSetup.create).not.toHaveBeenCalled();
  });

  it('rejects an attempt whose callback state was already cleared', async () => {
    await expect(
      remoteOauthAuthorizationService.resumeAuthorization({
        connection: {
          status: 'active',
          config: { config: {}, scopes: [] }
        } as any,
        setup: {
          status: 'pending',
          stateIdentifier: null,
          codeVerifier: null,
          tenant: { oid: 11n }
        } as any,
        serverOAuthSetup: { callbackUrlOverride: null }
      })
    ).rejects.toThrow('OAuth authorization attempt is no longer active');
  });
});

describe('remoteOauthAuthorizationService.completeAuthorization', () => {
  it('completes OAuth and records a sanitized event when user-info is rejected', async () => {
    let tenant = { oid: 11n };
    let connection = {
      oid: 12n,
      id: 'remote_connection_test',
      configOid: 14n,
      serverOid: 15n,
      tenantOid: tenant.oid,
      registrationOid: null,
      config: {
        config: {
          authorization_endpoint: 'https://provider.example.com/authorize',
          token_endpoint: 'https://provider.example.com/token',
          userinfo_endpoint: 'https://provider.example.com/userinfo'
        }
      },
      serverOAuthCredentials: { oid: 16n }
    };
    let serverOAuthSetup = {
      oid: 17n,
      id: 'oauth_setup_test',
      tenantOid: tenant.oid,
      callbackUrlOverride: null,
      redirectUri: 'https://app.example.com/oauth/complete',
      serverInstanceConfiguration: null
    };
    let attempt = {
      oid: 18n,
      stateIdentifier: 'test-state',
      codeVerifier: null,
      connection,
      tenant,
      serverOAuthSetup
    };

    dbMock.remoteOAuthConnectionSetup.findFirst.mockResolvedValue(attempt);
    dbMock.remoteOAuthConnectionSetup.updateMany.mockResolvedValue({ count: 1 });
    dbMock.remoteOAuthConnectionAuthToken.create.mockResolvedValue({
      oid: 19n,
      id: 'remote_token_test'
    });
    dbMock.serverAuthConfig.create.mockResolvedValue({
      oid: 20n,
      id: 'auth_config_test'
    });
    dbMock.serverOAuthSetup.update.mockResolvedValue(serverOAuthSetup);
    oauthUtilsMock.exchangeCodeForTokens.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 3600
    });
    oauthUtilsMock.getUserProfile.mockRejectedValue(
      new ServiceError(
        badRequestError({
          code: 'oauth_userinfo_failed',
          message: 'OAuth user profile lookup failed (HTTP 401)'
        })
      )
    );
    secretServiceMock.createSecret.mockResolvedValue({ oid: 21n });

    let result = await remoteOauthAuthorizationService.completeAuthorization({
      fullUrl: 'https://shuttle.example.com/shuttle-oauth/callback?code=test&state=test-state',
      response: { code: 'test-code', state: 'test-state' }
    });

    expect(result.redirectUrl).toContain('metorial_oauth_setup_id=oauth_setup_test');
    expect(dbMock.remoteOAuthConnectionProfile.upsert).not.toHaveBeenCalled();
    expect(dbMock.remoteOAuthConnectionAuthToken.create).toHaveBeenCalledTimes(1);
    expect(serverEventServiceMock.recordServerOAuthSetupEvent).toHaveBeenCalledWith({
      serverOAuthSetup,
      type: 'oauth_setup_user_profile_failed',
      message: 'OAuth user profile lookup failed (HTTP 401)',
      payload: { errorCode: 'oauth_userinfo_failed' }
    });
  });
});
