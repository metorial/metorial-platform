import { uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { oauthApi } from '../src';

let call = async (path: string, init: RequestInit = {}) => {
  let response = await oauthApi.fetch(new Request(`http://localhost${path}`, init));
  let text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
};

let form = (body: Record<string, string>) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body).toString()
});

describe('api-oauth', () => {
  it('serves OpenID and OAuth discovery metadata', async () => {
    let openId = await call('/.well-known/openid-configuration');
    expect(openId.status).toBe(200);
    expect(openId.body.issuer).toBeTruthy();
    expect(openId.body.token_endpoint).toBe(`${openId.body.issuer}/oauth/token`);
    expect(openId.body.jwks_uri).toBe(`${openId.body.issuer}/oauth/jwks`);
    expect(openId.body.grant_types_supported).toContain('client_credentials');

    let authorizationServer = await call('/.well-known/oauth-authorization-server');
    expect(authorizationServer.status).toBe(200);
    expect(authorizationServer.body).toEqual(openId.body);

    let protectedResource = await call('/.well-known/oauth-protected-resource');
    expect(protectedResource.status).toBe(200);
    expect(protectedResource.body.authorization_servers).toEqual([openId.body.issuer]);

    let jwks = await call('/oauth/jwks');
    expect(jwks.status).toBe(200);
    expect(Array.isArray(jwks.body.keys)).toBe(true);
  });

  it('rejects invalid token requests with OAuth errors', async () => {
    let missingGrant = await call('/oauth/token', form({ client_id: uniqueId('client') }));
    expect(missingGrant.status).toBe(400);
    expect(missingGrant.body.error).toBe('invalid_request');

    let missingClient = await call('/oauth/token', form({ grant_type: 'client_credentials' }));
    expect(missingClient.status).toBe(400);
    expect(missingClient.body.error).toBe('invalid_request');

    let missingSecret = await call(
      '/oauth/token',
      form({ grant_type: 'client_credentials', client_id: uniqueId('client') })
    );
    expect(missingSecret.status).toBe(401);
    expect(missingSecret.body.error).toBe('invalid_client');

    let unsupported = await call(
      '/oauth/token',
      form({ grant_type: 'password', client_id: uniqueId('client') })
    );
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error).toBe('unsupported_grant_type');
  });

  it('rejects invalid authorize requests', async () => {
    let missingResponseType = await call(`/oauth/authorize?client_id=${uniqueId('client')}`);
    expect(missingResponseType.status).toBe(400);
    expect(missingResponseType.body.error).toBe('invalid_request');

    let unsupportedResponseType = await call(
      `/oauth/authorize?response_type=token&client_id=${uniqueId('client')}`
    );
    expect(unsupportedResponseType.status).toBe(400);
    expect(unsupportedResponseType.body.error).toBe('unsupported_response_type');

    let missingRedirect = await call(
      `/oauth/authorize?response_type=code&client_id=${uniqueId('client')}`
    );
    expect(missingRedirect.status).toBe(400);
    expect(missingRedirect.body.error_message).toMatch(/redirect_uri/);
  });

  it('rejects userinfo requests without a valid access token', async () => {
    let missing = await call('/oauth/userinfo');
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('invalid_request');

    let invalid = await call('/oauth/userinfo', {
      headers: { authorization: `Bearer ${uniqueId('not-a-token')}` }
    });
    expect(invalid.status).toBe(401);
  });
});
