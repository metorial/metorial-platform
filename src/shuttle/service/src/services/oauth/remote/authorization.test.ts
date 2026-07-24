import { beforeEach, describe, expect, it, vi } from 'vitest';

let { defaultRedirectUri, dbMock, oauthUtilsMock, remoteOAuthConnectionServiceMock } =
  vi.hoisted(() => ({
    defaultRedirectUri: 'https://shuttle.example.com/shuttle-oauth/callback',
    dbMock: {
      remoteOAuthConnection: {
        findFirstOrThrow: vi.fn()
      },
      remoteOAuthConnectionSetup: {
        create: vi.fn()
      }
    },
    oauthUtilsMock: {
      generateCodeVerifier: vi.fn(),
      generateCodeChallenge: vi.fn(),
      buildAuthorizationUrl: vi.fn()
    },
    remoteOAuthConnectionServiceMock: {
      DANGEROUSLY_getCredentials: vi.fn()
    }
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
  secretService: {}
}));

vi.mock('../serverEvent', () => ({
  serverEventService: {}
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
        config: expect.objectContaining({
          authorization_endpoint: 'https://provider.example.com/authorize'
        }),
        clientId: 'test-client-id',
        redirectUri: callbackUrlOverride,
        scopes: ['repo'],
        state: 'test-state',
        codeChallenge: 'test-code-challenge'
      })
    );
  });
});
