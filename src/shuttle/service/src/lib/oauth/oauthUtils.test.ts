import { beforeEach, describe, expect, it, vi } from 'vitest';

let { axiosPost } = vi.hoisted(() => ({ axiosPost: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    defaults: { headers: { common: {} } },
    post: axiosPost,
    get: vi.fn()
  }
}));

vi.mock('../../config', () => ({ oauthCallbackUrl: 'https://metorial.test/callback' }));
vi.mock('../../db', () => ({ db: {} }));
vi.mock('../http/axiosSsrf', () => ({ getAxiosSsrfFilter: () => ({}) }));
vi.mock('../network/egressPolicy', () => ({
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
      config
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
      config
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
