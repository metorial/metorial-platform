import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  setupFindUnique: vi.fn(),
  setupFindFirst: vi.fn(),
  setupUpdateMany: vi.fn(async () => ({ count: 1 })),
  eventCreateMany: vi.fn(async () => ({ count: 1 })),
  authConfigCreate: vi.fn(async () => ({ id: 'shiac_new', oid: 70n })),
  processAuthAdd: vi.fn(async () => {}),
  decrypt: vi.fn(),
  updateSecret: vi.fn(async () => {}),
  createSecret: vi.fn(async () => ({ oid: 80n })),
  getOAuthUrl: vi.fn(),
  getAdminOAuthUrl: vi.fn(),
  getOAuthCallback: vi.fn(),
  getAdminOAuthCallback: vi.fn(),
  recordSlateError: vi.fn(async () => {})
}));

vi.mock('../env', () => ({
  env: { service: { SERVICE_PUBLIC_URL: 'http://hub.test', METORIAL_ENV: 'development' } }
}));

vi.mock('../db', () => ({
  db: {
    slateInstanceOAuthSetup: {
      findUnique: mocks.setupFindUnique,
      findFirst: mocks.setupFindFirst,
      updateMany: mocks.setupUpdateMany
    },
    slateInstanceOAuthSetupEvent: { createMany: mocks.eventCreateMany },
    slateAuthConfig: { create: mocks.authConfigCreate }
  }
}));

vi.mock('../id', () => ({
  getId: () => ({ id: 'shiac_new', oid: 70n }),
  ID: { generateIdSync: () => 'shsoe_test' },
  snowflake: { nextId: () => 999n }
}));

vi.mock('../queues/instance/processAuth', () => ({
  processAuthQueue: { add: mocks.processAuthAdd }
}));

vi.mock('./secret', () => ({
  secretService: {
    DANGEROUSLY_decryptSecret: mocks.decrypt,
    DANGEROUSLY_updateSecret: mocks.updateSecret,
    createSecret: mocks.createSecret
  }
}));

vi.mock('./slateError', () => ({
  slateErrorService: { recordSlateError: mocks.recordSlateError }
}));

vi.mock('./slateInvocation', () => ({
  slateInvocationService: {
    createInvocation: vi.fn(async () => ({})),
    getOAuthUrl: mocks.getOAuthUrl,
    getAdminOAuthUrl: mocks.getAdminOAuthUrl,
    getOAuthCallback: mocks.getOAuthCallback,
    getAdminOAuthCallback: mocks.getAdminOAuthCallback
  }
}));

let { slateOAuthHandlerService } = await import('./slateOAuthHandler');

let invocation = { oid: 500n };

let setup = (overrides: Record<string, unknown> = {}) => ({
  id: 'shios_1',
  oid: 1n,
  status: 'opened',
  isAdminSetup: false,
  adminInstructions: null,
  redirectUrl: 'https://integrations.test/oauth-setup/done',
  callbackUrlOverride: null,
  secretOid: 10n,
  tenantOid: 20n,
  slateVersionOid: 30n,
  slateInstanceOid: null,
  oauthCredentialsOid: 40n,
  tenant: { oid: 20n },
  slateVersion: { oid: 30n, slateOid: 31n },
  authMethod: { oid: 50n, key: 'oauth' },
  oauthCredentials: { id: 'shoc_1', secretOid: 41n, scopes: ['User.Read'] },
  instanceConfiguration: null,
  ...overrides
});

let withSetups = (...setups: ReturnType<typeof setup>[]) =>
  mocks.setupFindUnique.mockImplementation(
    async (args: { where: { id: string } }) => setups.find(s => s.id === args.where.id) ?? null
  );

let callback = (input: {
  code?: string;
  callbackParams?: Record<string, string>;
  state?: string | null;
  cookies?: string[];
  lastCookie?: string;
}) =>
  slateOAuthHandlerService.completeOAuthFlow({
    input: {
      code: input.code,
      state: input.state === null ? undefined : (input.state ?? 'shios_1'),
      setupCookieIds: input.cookies ?? ['shios_1'],
      lastSetupCookieId: input.lastCookie ?? input.cookies?.at(-1) ?? 'shios_1',
      callbackParams: input.callbackParams ?? {}
    }
  });

let reportError = (input: {
  state?: string;
  cookies: string[];
  error: string;
  errorDescription?: string;
}) =>
  slateOAuthHandlerService.reportError({
    input: {
      state: input.state,
      setupCookieIds: input.cookies,
      lastSetupCookieId: input.cookies.at(-1),
      error: input.error,
      errorDescription: input.errorDescription
    }
  });

let setupUpdates = () =>
  mocks.setupUpdateMany.mock.calls.map(call => (call as any)[0].data as Record<string, any>);

let eventTypes = () =>
  mocks.eventCreateMany.mock.calls.flatMap(call => {
    let data = (call as any)[0].data;
    return (Array.isArray(data) ? data : [data]).map((event: { type: string }) => event.type);
  });

beforeEach(() => {
  vi.clearAllMocks();

  mocks.decrypt.mockImplementation(async (d: { purpose: string }) =>
    d.purpose === 'slate_oauth_credentials'
      ? { clientId: 'client-1', clientSecret: 'secret-1' }
      : { input: {}, callbackState: undefined }
  );
});

describe('slateOAuthHandlerService.completeOAuthFlow', () => {
  it('completes an admin setup without a code and creates no auth config', async () => {
    withSetups(setup({ isAdminSetup: true }));
    mocks.getAdminOAuthCallback.mockResolvedValue({
      status: 'success',
      invocation,
      data: { instructions: '## Done\n\nAssign users in Entra.' }
    });

    let res = await callback({
      callbackParams: { admin_consent: 'True', tenant: 'tenant-1' }
    });

    expect(mocks.getAdminOAuthCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        code: undefined,
        state: 'shios_1',
        callbackParams: { admin_consent: 'True', tenant: 'tenant-1' }
      })
    );
    expect(mocks.getOAuthCallback).not.toHaveBeenCalled();

    expect(setupUpdates()).toEqual([
      {
        status: 'completed',
        adminInstructions: '## Done\n\nAssign users in Entra.',
        errorCode: null,
        errorMessage: null
      }
    ]);

    expect(mocks.createSecret).not.toHaveBeenCalled();
    expect(mocks.authConfigCreate).not.toHaveBeenCalled();
    expect(mocks.processAuthAdd).not.toHaveBeenCalled();

    expect(eventTypes()).toEqual(['oauth_setup_completed']);
    expect(mocks.eventCreateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'oauth_setup_completed', invocationOid: 500n })
    });

    let redirect = new URL(res.redirectUrl);
    expect(redirect.searchParams.get('slate_auth_status')).toBe('completed');
    expect(redirect.searchParams.get('slate_oauth_setup_id')).toBe('shios_1');
    expect(redirect.searchParams.has('slate_auth_config_id')).toBe(false);
  });

  it('fails an admin setup with the slate error code when the admin callback errors', async () => {
    withSetups(setup({ isAdminSetup: true }));
    mocks.getAdminOAuthCallback.mockResolvedValue({
      status: 'error',
      invocation,
      error: { code: 'admin_consent_denied', message: 'Admin consent was not granted' }
    });

    let res = await callback({ callbackParams: { admin_consent: 'False' } });

    expect(setupUpdates()).toEqual([
      {
        status: 'failed',
        errorCode: 'admin_consent_denied',
        errorMessage: 'Admin consent was not granted'
      }
    ]);
    expect(mocks.recordSlateError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'admin_consent_denied', invocationOid: 500n })
    );
    expect(mocks.authConfigCreate).not.toHaveBeenCalled();
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('failed');
  });

  it('stores the upstream error code a slate reports in its error baggage', async () => {
    withSetups(setup({ isAdminSetup: true }));
    mocks.getAdminOAuthCallback.mockResolvedValue({
      status: 'error',
      invocation,
      error: {
        code: 'request.bad',
        message: 'Admin consent could not be verified.',
        baggage: {
          serviceError: { code: 'bad_request', status: 400 },
          serviceErrorData: { upstreamCode: 'AADSTS700016' }
        }
      }
    });

    await callback({ callbackParams: { admin_consent: 'True' } });

    expect(setupUpdates()).toEqual([
      {
        status: 'failed',
        errorCode: 'AADSTS700016',
        errorMessage: 'Admin consent could not be verified.'
      }
    ]);
    expect(mocks.recordSlateError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'AADSTS700016' })
    );
  });

  it('rejects an admin callback from a browser without the setup cookie and leaves the setup usable', async () => {
    withSetups(setup({ isAdminSetup: true }), setup({ id: 'shios_other', oid: 2n }));

    await expect(
      callback({ cookies: ['shios_other'], callbackParams: { admin_consent: 'True' } })
    ).rejects.toThrow('This admin setup was started in a different browser.');

    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(mocks.getAdminOAuthCallback).not.toHaveBeenCalled();
    expect(mocks.setupUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventCreateMany).not.toHaveBeenCalled();
  });

  it('completes the admin setup named by the state when two admin flows run in one browser', async () => {
    withSetups(
      setup({ isAdminSetup: true }),
      setup({ id: 'shios_2', oid: 2n, isAdminSetup: true })
    );
    mocks.getAdminOAuthCallback.mockResolvedValue({ status: 'success', invocation, data: {} });

    let res = await callback({
      state: 'shios_1',
      cookies: ['shios_1', 'shios_2'],
      lastCookie: 'shios_2',
      callbackParams: { admin_consent: 'True' }
    });

    expect(mocks.getAdminOAuthCallback).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'shios_1' })
    );
    expect(mocks.setupUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.setupUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ oid: 1n }) })
    );
    expect(setupUpdates()).toEqual([expect.objectContaining({ status: 'completed' })]);

    let redirect = new URL(res.redirectUrl);
    expect(redirect.searchParams.get('slate_auth_status')).toBe('completed');
    expect(redirect.searchParams.get('slate_oauth_setup_id')).toBe('shios_1');
  });

  it('completes an admin setup when the setup cookie matches the state', async () => {
    withSetups(setup({ isAdminSetup: true }));
    mocks.getAdminOAuthCallback.mockResolvedValue({
      status: 'success',
      invocation,
      data: {}
    });

    let res = await callback({
      cookies: ['shios_1'],
      callbackParams: { admin_consent: 'True' }
    });

    expect(mocks.getAdminOAuthCallback).toHaveBeenCalledTimes(1);
    expect(setupUpdates()).toEqual([expect.objectContaining({ status: 'completed' })]);
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('completed');
  });

  it('does not flip an admin setup completed by a concurrent callback to failed', async () => {
    mocks.setupFindUnique
      .mockResolvedValueOnce(setup({ isAdminSetup: true }))
      .mockResolvedValueOnce({ status: 'completed', slateAuthConfig: null });
    mocks.setupUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.getAdminOAuthCallback.mockResolvedValue({
      status: 'error',
      invocation,
      error: { code: 'admin_consent_denied', message: 'Admin consent was not granted' }
    });

    let res = await callback({ callbackParams: { admin_consent: 'True' } });

    expect(mocks.setupUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.setupUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n, status: { not: 'completed' } },
        data: expect.objectContaining({ status: 'failed' })
      })
    );
    expect(mocks.recordSlateError).not.toHaveBeenCalled();
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('completed');
  });

  it('only completes an admin setup that is still open', async () => {
    mocks.setupFindUnique
      .mockResolvedValueOnce(setup({ isAdminSetup: true }))
      .mockResolvedValueOnce({ status: 'failed', slateAuthConfig: null });
    mocks.setupUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.getAdminOAuthCallback.mockResolvedValue({ status: 'success', invocation, data: {} });

    let res = await callback({ callbackParams: { admin_consent: 'True' } });

    expect(mocks.setupUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n, status: { notIn: ['completed', 'failed'] } },
        data: expect.objectContaining({ status: 'completed' })
      })
    );
    expect(eventTypes()).not.toContain('oauth_setup_completed');
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('failed');
  });

  it('redirects a duplicate regular callback to the auth config of the completed setup', async () => {
    mocks.setupFindUnique
      .mockResolvedValueOnce(setup())
      .mockResolvedValueOnce({ status: 'completed', slateAuthConfig: { id: 'shiac_first' } });
    mocks.setupUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.getOAuthCallback.mockResolvedValue({
      status: 'error',
      invocation,
      error: { code: 'invalid_grant', message: 'Code already redeemed' }
    });

    let res = await callback({ code: 'code-1' });

    let redirect = new URL(res.redirectUrl);
    expect(redirect.searchParams.get('slate_auth_status')).toBe('completed');
    expect(redirect.searchParams.get('slate_auth_config_id')).toBe('shiac_first');
  });

  it('does not complete an admin setup that already failed', async () => {
    withSetups(setup({ isAdminSetup: true, status: 'failed' }));

    let res = await callback({ callbackParams: { admin_consent: 'True' } });

    expect(mocks.getAdminOAuthCallback).not.toHaveBeenCalled();
    expect(mocks.setupUpdateMany).not.toHaveBeenCalled();
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('failed');
  });

  it('fails a regular setup without a code with missing_code', async () => {
    withSetups(setup());

    let res = await callback({});

    expect(mocks.setupFindFirst).not.toHaveBeenCalled();
    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(mocks.getOAuthCallback).not.toHaveBeenCalled();
    expect(mocks.getAdminOAuthCallback).not.toHaveBeenCalled();
    expect(setupUpdates()).toEqual([
      { status: 'failed', errorCode: 'missing_code', errorMessage: 'missing_code' }
    ]);
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('failed');
  });

  it('creates an auth config for a regular setup with a code', async () => {
    withSetups(setup());
    mocks.getOAuthCallback.mockResolvedValue({
      status: 'success',
      invocation,
      data: { output: { token: 'abc' }, scopes: ['User.Read'] }
    });

    let res = await callback({ code: 'code-1' });

    expect(mocks.getOAuthCallback).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'code-1' })
    );
    expect(eventTypes()).toEqual([
      'exchange_authorization_code',
      'access_token_received',
      'oauth_setup_completed'
    ]);
    expect(mocks.authConfigCreate).toHaveBeenCalledTimes(1);
    expect(setupUpdates()).toEqual([
      { status: 'completed', slateAuthConfigOid: 70n, errorCode: null, errorMessage: null }
    ]);
    expect(mocks.processAuthAdd).toHaveBeenCalledWith({ configId: 'shiac_new' });

    let redirect = new URL(res.redirectUrl);
    expect(redirect.searchParams.get('slate_auth_status')).toBe('completed');
    expect(redirect.searchParams.get('slate_auth_config_id')).toBe('shiac_new');
  });

  it('resolves the setup from the last setup cookie when the provider omits the state', async () => {
    withSetups(setup());
    mocks.getOAuthCallback.mockResolvedValue({
      status: 'success',
      invocation,
      data: { output: { token: 'abc' } }
    });

    let res = await callback({ code: 'verifier-1', state: null, lastCookie: 'shios_1' });

    expect(mocks.setupFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'shios_1' } })
    );
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('completed');
  });
});

describe('slateOAuthHandlerService.reportError', () => {
  it('stores the provider error code alongside the message', async () => {
    withSetups(setup());

    let res = await reportError({
      state: 'shios_1',
      cookies: ['shios_1'],
      error: 'consent_required',
      errorDescription: 'AADSTS90094: Admin consent is required.'
    });

    expect(setupUpdates()).toEqual([
      {
        status: 'failed',
        errorCode: 'consent_required',
        errorMessage: 'consent_required: AADSTS90094: Admin consent is required.'
      }
    ]);
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('failed');
  });

  it('fails the setup named by the state rather than the one in the cookie', async () => {
    withSetups(setup({ id: 'shios_cookie', oid: 2n }), setup({ id: 'shios_state', oid: 3n }));

    let res = await reportError({
      state: 'shios_state',
      cookies: ['shios_cookie'],
      error: 'access_denied'
    });

    expect(mocks.setupUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.setupUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ oid: 3n }) })
    );
    expect(new URL(res.redirectUrl).searchParams.get('slate_oauth_setup_id')).toBe(
      'shios_state'
    );
  });

  it('rejects a state that matches no setup', async () => {
    withSetups(setup({ id: 'shios_cookie', oid: 2n }));

    await expect(
      reportError({
        state: 'shios_unknown',
        cookies: ['shios_cookie'],
        error: 'access_denied'
      })
    ).rejects.toThrow('OAuth state does not match the expected value.');

    expect(mocks.setupUpdateMany).not.toHaveBeenCalled();
  });

  it('does not fail an admin setup from a forged error without its setup cookie', async () => {
    withSetups(setup({ isAdminSetup: true }));

    await expect(
      reportError({ state: 'shios_1', cookies: ['shios_attacker'], error: 'access_denied' })
    ).rejects.toThrow('This admin setup was started in a different browser.');

    expect(mocks.setupUpdateMany).not.toHaveBeenCalled();
  });

  it('fails an admin setup when the error arrives with its setup cookie', async () => {
    withSetups(setup({ isAdminSetup: true }), setup({ id: 'shios_2', oid: 2n }));

    let res = await reportError({
      state: 'shios_1',
      cookies: ['shios_1', 'shios_2'],
      error: 'access_denied'
    });

    expect(mocks.setupUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.setupUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ oid: 1n }) })
    );
    expect(setupUpdates()).toEqual([
      { status: 'failed', errorCode: 'access_denied', errorMessage: 'access_denied' }
    ]);
    expect(new URL(res.redirectUrl).searchParams.get('slate_auth_status')).toBe('failed');
  });
});

describe('slateOAuthHandlerService.startOAuthFlow', () => {
  it('refuses to restart a failed admin setup', async () => {
    mocks.setupFindUnique.mockResolvedValue(setup({ isAdminSetup: true, status: 'failed' }));

    await expect(
      slateOAuthHandlerService.startOAuthFlow({ setupId: 'shios_1' })
    ).rejects.toThrow('This admin setup has failed. Request a new admin setup link.');

    expect(mocks.setupUpdateMany).not.toHaveBeenCalled();
    expect(mocks.getAdminOAuthUrl).not.toHaveBeenCalled();
  });

  it('requests the admin authorization url for admin setups', async () => {
    mocks.setupFindUnique.mockResolvedValue(setup({ isAdminSetup: true }));
    mocks.getAdminOAuthUrl.mockResolvedValue({
      status: 'success',
      invocation,
      data: { authorizationUrl: 'https://login.microsoftonline.com/common/adminconsent' }
    });

    let res = await slateOAuthHandlerService.startOAuthFlow({ setupId: 'shios_1' });

    expect(mocks.getAdminOAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'shios_1', authenticationMethodId: 'oauth' })
    );
    expect(mocks.getOAuthUrl).not.toHaveBeenCalled();
    expect(res.authorizationUrl).toContain('/adminconsent');
  });

  it('requests the regular authorization url otherwise', async () => {
    mocks.setupFindUnique.mockResolvedValue(setup());
    mocks.getOAuthUrl.mockResolvedValue({
      status: 'success',
      invocation,
      data: { authorizationUrl: 'https://login.microsoftonline.com/common/authorize' }
    });

    await slateOAuthHandlerService.startOAuthFlow({ setupId: 'shios_1' });

    expect(mocks.getOAuthUrl).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminOAuthUrl).not.toHaveBeenCalled();
  });
});
