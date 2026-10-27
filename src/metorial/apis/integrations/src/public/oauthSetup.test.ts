import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getSetup: vi.fn(),
  handleResponse: vi.fn(),
  reconcile: vi.fn(async () => {}),
  getIntegrationSetupSession: vi.fn(async () => null as { id: string } | null)
}));

vi.mock('@metorial-subspace/module-auth', () => ({
  providerOAuthSetupInternalService: {
    getProviderOAuthSetupByClientSecret: mocks.getSetup,
    handleOAuthSetupResponse: mocks.handleResponse
  },
  getProviderSetupSessionPath: (session: { id: string }) => `/setup-session/${session.id}`
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  integrationSetupSessionService: {
    reconcileProviderSetupSessionCompleted: mocks.reconcile,
    getIntegrationSetupSessionByProviderSetupSession: mocks.getIntegrationSetupSession
  }
}));

vi.mock('../internal/presenters', () => ({
  integrationSetupSessionUrl: (session: { id: string }) =>
    `https://ui.test/integration-setup-session/${session.id}`
}));

let { oauthSetupApp } = await import('./oauthSetup');

let adminSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'pas_1',
  status: 'completed',
  typeConcrete: 'admin',
  redirectUrl: null,
  ...overrides
});

let setup = (overrides: Record<string, unknown> = {}) => ({
  id: 'pao_1',
  status: 'opened',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  updatedAt: new Date(),
  redirectUrl: null,
  adminInstructions: '## Done',
  providerSetupSession: adminSession(),
  ...overrides
});

let callback = () => oauthSetupApp.request('/pao_1/callback?client_secret=secret');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIntegrationSetupSession.mockResolvedValue(null);
});

describe('OAuth setup callback', () => {
  it('redirects a callback that arrives after the sync worker completed the session', async () => {
    mocks.getSetup.mockResolvedValue(setup());
    mocks.handleResponse.mockResolvedValue({
      ...setup({ status: 'completed' }),
      session: null
    });

    let res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/setup-session/pas_1');
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('redirects a duplicate callback shortly after the setup completed', async () => {
    mocks.getSetup.mockResolvedValue(setup({ status: 'completed' }));
    mocks.getIntegrationSetupSession.mockResolvedValue({ id: 'iss_1' });

    let res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://ui.test/integration-setup-session/iss_1'
    );
    expect(mocks.handleResponse).not.toHaveBeenCalled();
  });

  it('refuses to replay the callback of a setup completed a while ago', async () => {
    mocks.getSetup.mockResolvedValue(
      setup({ status: 'completed', updatedAt: new Date(Date.now() - 10 * 60 * 1000) })
    );

    let res = await callback();

    expect(res.status).toBe(400);
    expect(mocks.getIntegrationSetupSession).not.toHaveBeenCalled();
  });

  it('does not redirect to an archived setup session', async () => {
    mocks.getSetup.mockResolvedValue(
      setup({
        status: 'completed',
        providerSetupSession: adminSession({ status: 'archived' })
      })
    );

    let res = await callback();

    expect(res.status).toBe(400);
    expect(mocks.getIntegrationSetupSession).not.toHaveBeenCalled();
  });

  it('sends a setup that is still in progress back to the OAuth setup page', async () => {
    mocks.getSetup.mockResolvedValue(setup());
    mocks.handleResponse.mockResolvedValue({ id: 'pao_1', status: 'opened', session: null });

    let res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/oauth-setup/pao_1?client_secret=secret');
  });

  it('keeps an in-progress setup on the OAuth setup page when its linked session already ended', async () => {
    mocks.getSetup.mockResolvedValue(
      setup({ providerSetupSession: adminSession({ status: 'expired' }) })
    );
    mocks.handleResponse.mockResolvedValue({ id: 'pao_1', status: 'opened', session: null });
    mocks.getIntegrationSetupSession.mockResolvedValue({ id: 'iss_1' });

    let res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/oauth-setup/pao_1?client_secret=secret');
    expect(mocks.getIntegrationSetupSession).not.toHaveBeenCalled();
  });

  it('sends an in-progress setup with a live integration session to the integration wizard', async () => {
    let liveSession = adminSession({ status: 'pending' });
    mocks.getSetup.mockResolvedValue(setup({ providerSetupSession: liveSession }));
    mocks.handleResponse.mockResolvedValue({
      id: 'pao_1',
      status: 'opened',
      session: liveSession
    });
    mocks.getIntegrationSetupSession.mockResolvedValue({ id: 'iss_1' });

    let res = await callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://ui.test/integration-setup-session/iss_1'
    );
  });
});
