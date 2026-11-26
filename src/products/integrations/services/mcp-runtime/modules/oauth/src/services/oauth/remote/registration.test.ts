import { beforeEach, describe, expect, it, vi } from 'vitest';

let { dbMock, oauthUtilsMock } = vi.hoisted(() => ({
  dbMock: {
    remoteOAuthConnection: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    remoteOAuthConnectionEvent: {
      create: vi.fn()
    }
  },
  oauthUtilsMock: {
    supportsAuthRegistration: vi.fn(),
    registerClient: vi.fn()
  }
}));

vi.mock('@mtsrc/mcp-runtime-env', () => ({
  integrationsOAuthCallbackUrl: 'https://integrations.example.com/oauth-callback/mcp'
}));

vi.mock('@mtsrc/mcp-runtime-db', () => ({
  db: dbMock,
  getId: () => ({ oid: 1n, id: 'test_id' })
}));

vi.mock('@mtsrc/mcp-runtime-oauth-utils', async () => ({
  ...(await vi.importActual<object>('@mtsrc/mcp-runtime-oauth-utils/src/registrationRetry')),
  OAuthUtils: oauthUtilsMock
}));

import { remoteOAuthRegistrationService } from './registration';

let connection = (partial: Record<string, any> = {}) => ({
  oid: 10n,
  id: 'cso_test',
  status: 'active',
  discoveryStatus: 'failed',
  registrationOid: null,
  secretOid: null,
  registrationAttemptCount: 0,
  tenant: { oid: 2n, id: 'ten_test', name: 'Test', dynamicOAuthCallbackUrlOverride: null },
  config: {
    oid: 3n,
    config: { registration_endpoint: 'https://provider.example.com/register' }
  },
  _count: { remoteOAuthConnectionAuthTokens: 0, serverAuthConfigs: 0 },
  ...partial
});

beforeEach(() => {
  vi.clearAllMocks();
  oauthUtilsMock.supportsAuthRegistration.mockReturnValue(true);
});

describe('runAutoRegistration', () => {
  it('never re-registers a connection that already has tokens bound to it', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(
      connection({
        _count: { remoteOAuthConnectionAuthTokens: 1, serverAuthConfigs: 1 }
      })
    );

    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: 'cso_test'
    });

    expect(res).toEqual({ ok: false, reason: 'skipped', blocker: 'has_bound_credentials' });
    expect(oauthUtilsMock.registerClient).not.toHaveBeenCalled();
    expect(dbMock.remoteOAuthConnection.update).not.toHaveBeenCalled();
  });

  it('stores the registration and clears the error on success', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(connection());
    oauthUtilsMock.registerClient.mockResolvedValue({
      ok: true,
      registration: { oid: 20n, clientId: 'client-id' }
    });

    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: 'cso_test'
    });

    expect(res.ok).toBe(true);
    expect(oauthUtilsMock.registerClient).toHaveBeenCalledWith(
      expect.objectContaining({
        callback: { callbackUrlOverride: null, usesIntegrationsCallback: true }
      })
    );
    expect(dbMock.remoteOAuthConnection.update).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({
        registrationOid: 20n,
        clientId: 'client-id',
        discoveryStatus: 'succeeded',
        errorCode: null,
        errorMessage: null,
        registrationAttemptCount: 0
      })
    });
  });

  it('takes the override from the owning tenant at registration time', async () => {
    let callbackUrlOverride = 'https://customer.example.com/callback';
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(
      connection({ tenant: { dynamicOAuthCallbackUrlOverride: callbackUrlOverride } })
    );
    oauthUtilsMock.registerClient.mockResolvedValue({
      ok: true,
      registration: { oid: 20n, clientId: 'client' }
    });

    await remoteOAuthRegistrationService.runAutoRegistration({ connectionId: 'cso_test' });

    expect(oauthUtilsMock.registerClient).toHaveBeenCalledWith(
      expect.objectContaining({
        callback: { callbackUrlOverride, usesIntegrationsCallback: true }
      })
    );
  });

  it('counts an attempt for provider validation errors', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(connection());
    oauthUtilsMock.registerClient.mockResolvedValue({
      ok: false,
      status: 400,
      oauthCode: 'invalid_client_metadata',
      message: 'Invalid redirect URI',
      description: 'redirect_uris is not allowed',
      responseText: '{"error":"invalid_client_metadata"}',
      responseTruncated: false,
      contentType: 'application/json',
      retryAfterMs: null,
      isTransient: false
    });

    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: 'cso_test'
    });

    expect(res).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'failed',
        isTransient: false,
        diagnostics: expect.objectContaining({
          status: 400,
          oauthCode: 'invalid_client_metadata',
          message:
            'Invalid redirect URI: redirect_uris is not allowed. Configure OAuth client credentials manually to continue.',
          responseText: '{"error":"invalid_client_metadata"}'
        })
      })
    );
    expect(dbMock.remoteOAuthConnection.update).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({
        discoveryStatus: 'failed',
        errorCode: 'auto_registration_failed',
        errorMessage:
          'OAuth client registration failed (HTTP 400, OAuth error invalid_client_metadata). Configure OAuth client credentials manually to continue.',
        registrationAttemptCount: 1
      })
    });
  });

  it('does not spend the retry budget on transient provider failures', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(
      connection({ registrationAttemptCount: 3 })
    );
    oauthUtilsMock.registerClient.mockResolvedValue({
      ok: false,
      status: 504,
      oauthCode: null,
      message: 'OAuth client registration failed (HTTP 504)',
      isTransient: true
    });

    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: 'cso_test'
    });

    expect(res).toEqual(
      expect.objectContaining({ ok: false, reason: 'failed', isTransient: true })
    );
    expect(dbMock.remoteOAuthConnection.update).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({ registrationAttemptCount: 3 })
    });
  });

  it('does not ask the OAuth helper to report provider failures to Sentry', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(
      connection({ registrationAttemptCount: 2 })
    );
    oauthUtilsMock.registerClient.mockResolvedValue({
      ok: false,
      status: 400,
      oauthCode: null,
      message: 'OAuth client registration failed (HTTP 400)',
      isTransient: false
    });

    await remoteOAuthRegistrationService.runAutoRegistration({ connectionId: 'cso_test' });

    expect(oauthUtilsMock.registerClient).toHaveBeenCalledWith(
      expect.not.objectContaining({ captureErrors: expect.anything() })
    );
  });

  it('marks providers without a registration endpoint as unsupported', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(connection());
    oauthUtilsMock.supportsAuthRegistration.mockReturnValue(false);

    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: 'cso_test'
    });

    expect(res).toEqual({ ok: false, reason: 'unsupported' });
    expect(dbMock.remoteOAuthConnection.update).toHaveBeenCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({ errorCode: 'auto_registration_unsupported' })
    });
    expect(oauthUtilsMock.registerClient).not.toHaveBeenCalled();
  });
});
