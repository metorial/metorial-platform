import { beforeEach, describe, expect, it, vi } from 'vitest';

let { consumeSetupMock } = vi.hoisted(() => ({
  consumeSetupMock: vi.fn()
}));

vi.mock('../../db', () => ({ db: {} }));
vi.mock('../../services', () => ({
  remoteOauthAuthorizationService: {},
  serverOAuthSetupService: {
    consumeServerOAuthSetup: consumeSetupMock
  }
}));
vi.mock('../../services/oauth/delegated', () => ({
  delegatedOauthAuthorizationService: {}
}));

import { publicApp } from './index';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /shuttle-oauth/start', () => {
  it('rejects requests without a setup id', async () => {
    let response = await publicApp.request(
      'https://shuttle.example.com/shuttle-oauth/start'
    );

    expect(response.status).toBe(400);
    expect(consumeSetupMock).not.toHaveBeenCalled();
  });

  it('redirects repeated starts and refreshes the state cookie', async () => {
    consumeSetupMock.mockResolvedValue({
      url: 'https://provider.example.com/authorize',
      state: 'existing-state'
    });

    let first = await publicApp.request(
      'https://shuttle.example.com/shuttle-oauth/start?setup_id=csos_test'
    );
    let second = await publicApp.request(
      'https://shuttle.example.com/shuttle-oauth/start?setup_id=csos_test'
    );

    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(first.headers.get('location')).toBe('https://provider.example.com/authorize');
    expect(second.headers.get('location')).toBe('https://provider.example.com/authorize');
    expect(second.headers.get('set-cookie')).toContain('subspace_oauth_state=existing-state');
    expect(consumeSetupMock).toHaveBeenCalledTimes(2);
  });

  it('clears stale state when redirecting a terminal setup upstream', async () => {
    consumeSetupMock.mockResolvedValue({
      url: 'https://subspace.example.com/oauth-setup/callback',
      state: null
    });

    let response = await publicApp.request(
      'https://shuttle.example.com/shuttle-oauth/start?setup_id=csos_test',
      {
        headers: {
          Cookie: 'subspace_oauth_state=stale-state'
        }
      }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://subspace.example.com/oauth-setup/callback'
    );
    expect(response.headers.get('set-cookie')).toContain('subspace_oauth_state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
