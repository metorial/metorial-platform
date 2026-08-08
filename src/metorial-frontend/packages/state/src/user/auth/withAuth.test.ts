import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { withDashboardSDK } = vi.hoisted(() => ({
  withDashboardSDK: vi.fn()
}));

vi.mock('../../sdk', () => ({ withDashboardSDK }));
vi.mock('@metorial/frontend-config', () => ({
  awaitConfig: vi.fn(async () => ({
    auth: {
      loginPath: '/login',
      logoutPath: '/logout',
      signupPath: '/signup'
    }
  }))
}));

import { fetchUserSpecial } from './withAuth';

describe('fetchUserSpecial', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      location: {
        href: 'https://account.metorial.com/',
        pathname: '/'
      },
      enterpriseRedirectToAuthIfNotAuthenticated: (fn: () => Promise<unknown>) => fn()
    });
  });

  it('reuses the federation user without calling the dashboard SDK', async () => {
    let user = {
      id: 'usr_123',
      name: 'Test User',
      email: 'test@example.com'
    };
    (window as any).enterpriseUserPromise = Promise.resolve(user);

    await expect(fetchUserSpecial()).resolves.toBe(user);
    expect(withDashboardSDK).not.toHaveBeenCalled();
  });
});
