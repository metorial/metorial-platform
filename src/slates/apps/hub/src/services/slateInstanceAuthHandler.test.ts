import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  class LockAcquisitionError extends Error {}
  return {
    LockAcquisitionError,
    eventCreateMany: vi.fn(async () => ({})),
    usingLock: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    decrypt: vi.fn(),
    updateSecret: vi.fn(),
    refreshOAuthToken: vi.fn(),
    syncSharedOAuthTokens: vi.fn(async () => ({ synced: 1 }))
  };
});

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: mocks.usingLock }),
  LockAcquisitionError: mocks.LockAcquisitionError
}));

vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));

vi.mock('../db', () => ({
  db: {
    slateAuthConfig: {
      findFirst: mocks.findFirst,
      findFirstOrThrow: mocks.findFirstOrThrow,
      updateMany: mocks.updateMany,
      update: mocks.update
    },
    slateAuthConfigUsedForInstance: { createMany: vi.fn(async () => ({})) },
    slateOAuthCredentials: {
      findFirstOrThrow: vi.fn(async () => ({
        id: 'shoc_1',
        oid: 50n,
        clientId: 'client-1',
        scopes: ['chat:write'],
        secret: { oid: 51n }
      }))
    },
    slateAuthMethod: {
      findFirstOrThrow: vi.fn(async () => ({
        key: 'oauth',
        slate: { oid: 10n, currentVersionOid: 11n },
        mostRecentSpecification: { mostRecentVersionOid: 11n }
      }))
    },
    slateVersion: { findFirstOrThrow: vi.fn(async () => ({ oid: 11n })) },
    slateAuthConfigEvent: { createMany: mocks.eventCreateMany }
  }
}));

vi.mock('../id', () => ({
  ID: { generateIdSync: () => 'shiace_test' },
  snowflake: { nextId: () => 999n }
}));

vi.mock('./secret', () => ({
  secretService: {
    DANGEROUSLY_decryptSecret: mocks.decrypt,
    DANGEROUSLY_updateSecret: mocks.updateSecret
  }
}));

vi.mock('./slateInvocation', () => ({
  slateInvocationService: {
    createInvocation: vi.fn(async () => ({})),
    refreshOAuthToken: mocks.refreshOAuthToken
  }
}));

vi.mock('./slateError', () => ({
  slateErrorService: { recordSlateError: vi.fn(async () => {}) }
}));

vi.mock('./sharedOAuthTokenSync', () => ({
  syncSharedOAuthTokens: mocks.syncSharedOAuthTokens
}));

vi.mock('../queues/trigger/routingMatcherResync', () => ({
  triggerRoutingMatcherResyncQueue: { add: vi.fn() }
}));

vi.mock('../lib/triggerRoutingMatcherSerialize', () => ({
  matcherSetFingerprint: vi.fn(async () => 'fp')
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));

let { slateAuthHandlerService } = await import('./slateInstanceAuthHandler');

let tenant = { oid: 1000n } as any;
let past = () => new Date(Date.now() - 60_000);
let future = () => new Date(Date.now() + 6 * 60 * 60_000);

let config = (overrides: Record<string, unknown> = {}) => ({
  id: 'shiac_a',
  oid: 1n,
  type: 'oauth_automated',
  isProcessing: false,
  errorCode: null,
  errorMessage: null,
  instanceOid: null,
  tokenExpiresAt: past(),
  oauthCredentialsOid: 50n,
  authMethodOid: 20n,
  slateOid: 10n,
  profileUid: 'UBOT',
  secretOid: 30n,
  routingMatchers: null,
  secret: { oid: 30n },
  authMethod: { key: 'oauth' },
  ...overrides
});

let oldExpiresAt = past().toISOString();
let oldSecret = () => ({
  input: {},
  output: { token: 'xoxb-old', refreshToken: 'xoxe-old', expiresAt: oldExpiresAt }
});
let newOutput = {
  token: 'xoxb-new',
  refreshToken: 'xoxe-new',
  expiresAt: future().toISOString()
};

let call = () =>
  slateAuthHandlerService.getSlateInstanceAuth({
    tenant,
    authConfigId: 'shiac_a',
    minExpirationBuffer: 30_000
  });

let lockBusy = () =>
  mocks.usingLock.mockRejectedValueOnce(new mocks.LockAcquisitionError('busy'));

let lockReleaseFails = () =>
  mocks.usingLock.mockImplementationOnce(async (_key: string, fn: () => Promise<unknown>) => {
    await fn();
    throw new Error('redis release failed');
  });

let refreshFails = () =>
  mocks.refreshOAuthToken.mockResolvedValue({
    status: 'error',
    invocation: { id: 'shiv_2', oid: 71n },
    error: { code: 'request.bad', message: 'Slack OAuth error: invalid_refresh_token' }
  });

describe('getSlateInstanceAuth refresh coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usingLock.mockImplementation(async (_key: string, fn: () => Promise<unknown>) =>
      fn()
    );
    mocks.findFirst.mockResolvedValue(config());
    mocks.findFirstOrThrow.mockResolvedValue(config());
    mocks.decrypt.mockImplementation(async (d: { purpose: string }) =>
      d.purpose === 'slate_oauth_credentials'
        ? { clientId: 'client-1', clientSecret: 'secret-1' }
        : oldSecret()
    );
    mocks.refreshOAuthToken.mockResolvedValue({
      status: 'success',
      invocation: { id: 'shiv_1', oid: 70n },
      data: { output: newOutput }
    });
  });

  it('refreshes under the identity lock and syncs siblings', async () => {
    let result = await call();

    expect(mocks.usingLock).toHaveBeenCalledTimes(1);
    expect(mocks.usingLock.mock.calls[0]![0]).toMatch(/^idn:/);
    expect(mocks.usingLock.mock.calls[0]![2]).toMatchObject({
      acquisitionTimeoutMs: 20_000,
      retryCount: 200
    });
    expect(mocks.updateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        secretOid: 30n,
        tenant,
        secretData: { input: {}, output: newOutput }
      })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n },
        data: expect.objectContaining({ tokenExpiresAt: new Date(newOutput.expiresAt) })
      })
    );
    expect(mocks.eventCreateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'oauth_token_refresh_completed', configOid: 1n })
    });
    expect(mocks.refreshOAuthToken).toHaveBeenCalledTimes(1);
    expect(result.output).toEqual(newOutput);
    expect(mocks.syncSharedOAuthTokens).toHaveBeenCalledWith({
      source: expect.objectContaining({
        authConfigId: 'shiac_a',
        clientId: 'client-1',
        authMethodKey: 'oauth',
        profileUid: 'UBOT'
      }),
      previousOutput: oldSecret().output,
      newOutput
    });
  });

  it('skips the refresh when a sibling already synced fresh tokens', async () => {
    mocks.findFirstOrThrow.mockResolvedValue(config({ tokenExpiresAt: future() }));
    mocks.decrypt.mockResolvedValueOnce({ input: {}, output: newOutput });

    let result = await call();

    expect(mocks.refreshOAuthToken).not.toHaveBeenCalled();
    expect(mocks.syncSharedOAuthTokens).not.toHaveBeenCalled();
    expect(result.output).toEqual(newOutput);
  });

  it('throws the stored error found after taking the lock', async () => {
    mocks.findFirstOrThrow.mockResolvedValue(
      config({
        errorCode: 'request.bad',
        errorMessage: 'Slack OAuth error: invalid_refresh_token'
      })
    );

    await expect(call()).rejects.toThrow(/invalid_refresh_token/);
    expect(mocks.refreshOAuthToken).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'hours ahead', expiresAt: () => future(), returns: true },
    { label: '10s ahead', expiresAt: () => new Date(Date.now() + 10_000), returns: true },
    { label: 'never', expiresAt: () => null, returns: true },
    { label: '2s ahead', expiresAt: () => new Date(Date.now() + 2_000), returns: false },
    { label: 'already passed', expiresAt: () => past(), returns: false }
  ])('when the lock is busy and the token expires $label', async ({ expiresAt, returns }) => {
    lockBusy();
    mocks.findFirstOrThrow.mockResolvedValue(config({ tokenExpiresAt: expiresAt() }));

    if (returns) {
      expect((await call()).output).toEqual(oldSecret().output);
    } else {
      await expect(call()).rejects.toThrow(/already in progress/);
    }
    expect(mocks.refreshOAuthToken).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'succeeded', fails: false },
    { label: 'failed', fails: true }
  ])(
    'keeps the outcome when releasing the lock fails after the refresh $label',
    async ({ fails }) => {
      if (fails) refreshFails();
      lockReleaseFails();

      if (fails) {
        await expect(call()).rejects.toThrow(/Failed to refresh authentication token/);
      } else {
        expect((await call()).output).toEqual(newOutput);
      }
      expect(mocks.refreshOAuthToken).toHaveBeenCalledTimes(1);
    }
  );

  it('stores the error and skips sibling sync when the refresh fails', async () => {
    refreshFails();

    await expect(call()).rejects.toThrow(/Failed to refresh authentication token/);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorCode: 'request.bad' }) })
    );
    expect(mocks.syncSharedOAuthTokens).not.toHaveBeenCalled();
  });

  it('does not fail the request when the sibling sync fails', async () => {
    mocks.syncSharedOAuthTokens.mockRejectedValueOnce(new Error('sync exploded'));

    let result = await call();

    expect(result.output).toEqual(newOutput);
  });

  it('takes no lock and decrypts once when the token is not expiring', async () => {
    mocks.findFirst.mockResolvedValue(config({ tokenExpiresAt: future() }));

    let result = await call();

    expect(mocks.usingLock).not.toHaveBeenCalled();
    expect(mocks.refreshOAuthToken).not.toHaveBeenCalled();
    expect(mocks.decrypt).toHaveBeenCalledTimes(1);
    expect(result.output).toEqual(oldSecret().output);
  });

  it('rethrows lock errors raised before any work ran', async () => {
    mocks.usingLock.mockRejectedValueOnce(new Error('redis exploded'));

    await expect(call()).rejects.toThrow('redis exploded');
    expect(mocks.refreshOAuthToken).not.toHaveBeenCalled();
  });

  it('skips the sibling sync when the profile appeared between reads', async () => {
    mocks.findFirst.mockResolvedValue(config({ profileUid: null }));

    await call();

    expect(mocks.usingLock.mock.calls[0]![0]).toBe('cfg:1');
    expect(mocks.refreshOAuthToken).toHaveBeenCalledTimes(1);
    expect(mocks.syncSharedOAuthTokens).not.toHaveBeenCalled();
  });
});
