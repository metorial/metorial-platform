import { describe, expect, it } from 'vitest';
import { call } from './_fixtures';

describe('api-oauth discovery', () => {
  it('advertises the endpoints, grants and client authentication methods it supports', async () => {
    let response = await call('/.well-known/openid-configuration');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);

    let metadata = response.body;
    let issuer = metadata.issuer;
    expect(new URL(issuer).toString()).toMatch(/^https?:\/\//);
    expect(metadata).toMatchObject({
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      jwks_uri: `${issuer}/oauth/jwks`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      device_authorization_endpoint: `${issuer}/oauth/device_authorization`,
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
      id_token_signing_alg_values_supported: ['ES256']
    });
    expect(metadata.grant_types_supported).toEqual(
      expect.arrayContaining([
        'authorization_code',
        'refresh_token',
        'client_credentials',
        'urn:ietf:params:oauth:grant-type:device_code'
      ])
    );
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(
      expect.arrayContaining(['client_secret_basic', 'client_secret_post', 'none'])
    );
    expect(metadata.scopes_supported).toEqual(
      expect.arrayContaining(['openid', 'organization:read'])
    );
    expect(metadata.code_challenge_methods_supported).not.toContain('plain');

    let authorizationServer = await call('/.well-known/oauth-authorization-server');
    expect(authorizationServer.body).toEqual(metadata);

    let protectedResource = await call('/.well-known/oauth-protected-resource');
    expect(protectedResource.body).toMatchObject({
      resource: issuer,
      authorization_servers: [issuer],
      bearer_methods_supported: ['header']
    });
  });

  it('publishes only public signing keys', async () => {
    let response = await call('/oauth/jwks');
    expect(response.status).toBe(200);

    for (let key of response.body.keys) {
      expect(key).toMatchObject({ kty: 'EC', crv: 'P-256', kid: expect.any(String) });
      expect(key).not.toHaveProperty('d');
    }
  });

  it('answers CORS preflights from any origin without credentials', async () => {
    let origin = 'https://client.example.com';
    let response = await call('/oauth/token', {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(response.headers.get('access-control-allow-methods')).toMatch(/POST/);
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('answers unknown routes and methods with JSON 404s', async () => {
    for (let response of [
      await call('/oauth/unknown'),
      await call('/oauth/authorize', { method: 'DELETE' })
    ]) {
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
    }
  });
});
