import { beforeEach, describe, expect, it, vi } from 'vitest';

let { axiosPost, createRegistration } = vi.hoisted(() => ({
  axiosPost: vi.fn(),
  createRegistration: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    defaults: { headers: { common: {} } },
    post: axiosPost,
    get: vi.fn()
  }
}));

vi.mock('@mtsrc/mcp-runtime-env', () => ({
  oauthCallbackUrl: 'https://shuttle.test/shuttle-oauth/callback',
  integrationsOAuthCallbackUrl: 'https://integrations.test/oauth-callback/mcp',
  clientBranding: {}
}));
vi.mock('@mtsrc/mcp-runtime-db', () => ({
  db: { remoteOAuthAutoRegistration: { create: createRegistration } },
  getId: () => ({ oid: 1n, id: 'registration' })
}));

vi.mock('@mtsrc/mcp-runtime-network', async importOriginal => ({
  ...(await importOriginal<object>()),
  getAxiosEgressOptions: () => ({}),
  assertUrlAllowedByEgressPolicy: vi.fn()
}));

import { OAuthUtils } from './oauthUtils';

let config = {
  authorization_endpoint: 'https://provider.test/authorize',
  token_endpoint: 'https://provider.test/token'
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OAuthUtils.refreshAccessToken', () => {
  it('retries one transient failure and returns the successful response', async () => {
    axiosPost
      .mockRejectedValueOnce({
        response: { status: 503, headers: { 'retry-after': '0' } }
      })
      .mockResolvedValueOnce({
        data: { access_token: 'new-token', token_type: 'Bearer' }
      });

    let result = await OAuthUtils.refreshAccessToken({
      tokenEndpoint: config.token_endpoint,
      clientId: 'client-id',
      refreshToken: 'refresh-token',
      config,
      egress: { tenantId: 'tenant' }
    });

    expect(result).toEqual({
      ok: true,
      response: { access_token: 'new-token', token_type: 'Bearer' }
    });
    expect(axiosPost).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent failures or expose provider response content', async () => {
    axiosPost.mockRejectedValue({
      message: 'Request failed for https://private.test/token',
      response: {
        status: 400,
        data: {
          error: 'invalid_grant',
          error_description: 'refresh_token=secret-value'
        }
      }
    });

    let result = await OAuthUtils.refreshAccessToken({
      tokenEndpoint: config.token_endpoint,
      clientId: 'client-id',
      refreshToken: 'refresh-token',
      config,
      egress: { tenantId: 'tenant' }
    });

    expect(result).toEqual({
      ok: false,
      error: {
        status: 400,
        oauthCode: 'invalid_grant',
        isTransient: false,
        retryAfterMs: null
      },
      message: 'OAuth token refresh failed (HTTP 400, OAuth error invalid_grant)'
    });
    expect(JSON.stringify(result)).not.toContain('secret-value');
    expect(JSON.stringify(result)).not.toContain('private.test');
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });
});

describe('OAuthUtils.registerClient', () => {
  it.each([
    { override: null, relay: true, uri: 'https://integrations.test/oauth-callback/mcp' },
    { override: null, relay: false, uri: 'https://shuttle.test/shuttle-oauth/callback' },
    {
      override: 'https://customer.test/callback/',
      relay: true,
      uri: 'https://customer.test/callback/'
    }
  ])('sends and stores the callback choice for $uri', async ({ override, relay, uri }) => {
    axiosPost.mockResolvedValueOnce({ data: { client_id: 'client-id' } });
    createRegistration.mockImplementationOnce(async ({ data }) => data);

    let result = await OAuthUtils.registerClient({
      tenant: { identifier: 'tenant', name: 'Test', functionBayTenantId: null } as any,
      config: { ...config, registration_endpoint: 'https://provider.test/register' },
      callback: { callbackUrlOverride: override, usesIntegrationsCallback: relay }
    });

    expect(axiosPost).toHaveBeenCalledWith(
      'https://provider.test/register',
      expect.objectContaining({ redirect_uris: [uri] }),
      expect.any(Object)
    );
    expect(result).toMatchObject({
      ok: true,
      registration: { callbackUrlOverride: override, usesIntegrationsCallback: relay }
    });
  });
});
