import { describe, expect, it, vi } from 'vitest';

let { parseTenantOAuthCallbackSlug } = vi.hoisted(() => ({
  parseTenantOAuthCallbackSlug: vi.fn().mockResolvedValue(null)
}));

vi.mock('@metorial-subspace/db', () => ({ parseTenantOAuthCallbackSlug }));

vi.mock('../env', () => ({
  env: { service: { SHUTTLE_PUBLIC_URL: 'https://shuttle.example.com' } }
}));

import { oauthCallbackApp } from './oauthCallback';

describe('the remote MCP callback relay', () => {
  it('redirects to regional Shuttle with the original query', async () => {
    let query = '?code=a%2Bb&state=c%20d&iss=https%3A%2F%2Fissuer.example.com&extra=1&extra=2';
    let response = await oauthCallbackApp.request(`/mcp${query}`);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      `https://shuttle.example.com/shuttle-oauth/callback${query}`
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(parseTenantOAuthCallbackSlug).not.toHaveBeenCalled();
  });

  it('preserves the provider-specific callback route', async () => {
    let response = await oauthCallbackApp.request('/project-provider-type');
    expect(response.status).toBe(400);
    expect(parseTenantOAuthCallbackSlug).toHaveBeenCalledWith('project-provider-type');
  });
});
