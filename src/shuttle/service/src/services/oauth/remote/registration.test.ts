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

vi.mock('../../../db', () => ({ db: dbMock }));

vi.mock('../../../id', () => ({
  getId: () => ({ oid: 1n, id: 'test_id' })
}));

vi.mock('../../../lib/oauth/oauthUtils', () => ({
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
  tenant: { oid: 2n, id: 'ten_test', name: 'Test' },
  config: { oid: 3n, config: { registration_endpoint: 'https://provider.example.com/register' } },
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

  it('counts an attempt for provider validation errors', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(connection());
    oauthUtilsMock.registerClient.mockResolvedValue({
      ok: false,
      error: { payload: { error: { message: 'Validation failed' } } },
      status: 400,
      isTransient: false
    });

    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: 'cso_test'
    });

    expect(res).toEqual({ ok: false, reason: 'failed', isTransient: false });
    expect(dbMock.remoteOAuthConnection.update).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({
        discoveryStatus: 'failed',
        errorCode: 'auto_registration_failed',
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
      error: { payload: { error: 'gateway timeout' } },
      status: 504,
      isTransient: true
    });

    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: 'cso_test'
    });

    expect(res).toEqual({ ok: false, reason: 'failed', isTransient: true });
    expect(dbMock.remoteOAuthConnection.update).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({ registrationAttemptCount: 3 })
    });
  });

  it('only reports the first failure of a connection to Sentry', async () => {
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(
      connection({ registrationAttemptCount: 2 })
    );
    oauthUtilsMock.registerClient.mockResolvedValue({
      ok: false,
      error: { payload: { error: 'nope' } },
      status: 400,
      isTransient: false
    });

    await remoteOAuthRegistrationService.runAutoRegistration({ connectionId: 'cso_test' });

    expect(oauthUtilsMock.registerClient).toHaveBeenCalledWith(
      expect.objectContaining({ captureErrors: false })
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
