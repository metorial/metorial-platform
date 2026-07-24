import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthDiscovery } from './discovery';
import { axiosWithoutSse } from '../http/sse';

vi.mock('../http/sse', () => ({
  axiosWithoutSse: vi.fn()
}));

let oauthConfig = {
  issuer: 'https://api.avo.app',
  authorization_endpoint: 'https://api.avo.app/oauth/authorize',
  token_endpoint: 'https://api.avo.app/oauth/token',
  scopes_supported: ['read', 'write']
};

describe('OAuthDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discovers authorization server metadata from protected resource metadata', async () => {
    let axios = vi.mocked(axiosWithoutSse);

    axios.mockImplementation(async url => {
      if (url === 'https://mcp.avo.app/.well-known/oauth-protected-resource') {
        return {
          status: 200,
          data: {
            resource: 'https://mcp.avo.app/mcp',
            authorization_servers: ['https://api.avo.app'],
            scopes_supported: ['read', 'write'],
            bearer_methods_supported: ['header']
          },
          headers: {}
        } as any;
      }

      if (url === 'https://api.avo.app/.well-known/oauth-authorization-server') {
        return {
          status: 200,
          data: oauthConfig,
          headers: {}
        } as any;
      }

      return {
        status: 404,
        data: {},
        headers: {}
      } as any;
    });

    await expect(OAuthDiscovery.discover('https://mcp.avo.app/mcp')).resolves.toMatchObject(
      oauthConfig
    );

    expect(axios).toHaveBeenCalledWith(
      'https://api.avo.app/.well-known/oauth-authorization-server',
      expect.any(Object)
    );
  });
});
