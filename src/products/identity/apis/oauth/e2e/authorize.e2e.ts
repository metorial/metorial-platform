import { uniqueId, useOrganization } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  authorizeUrl,
  call,
  createApplication,
  createPkce,
  expectOAuthError,
  getAuthorizationRequest,
  getRequestToken,
  postToken,
  redirectUri,
  rejectRequest
} from './_fixtures';

describe('api-oauth authorize', () => {
  let org = useOrganization();

  it('redirects valid requests to the consent page with an opaque request token', async () => {
    let client = await createApplication(org.ids);
    let pkce = createPkce();
    let state = uniqueId('state');

    let response = await call(
      authorizeUrl({
        response_type: 'code',
        client_id: client.clientId,
        redirect_uri: redirectUri,
        scope: 'openid organization:read',
        state,
        nonce: 'e2e-nonce',
        code_challenge: pkce.codeChallenge,
        code_challenge_method: 'S256'
      })
    );
    expect(response.status).toBe(302);

    let location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/oauth/authorize');
    expect([...location.searchParams.keys()]).toEqual(['token']);
    expect(location.searchParams.get('token')).toMatch(/^mtout_/);

    let request = await getAuthorizationRequest(getRequestToken(response));
    expect(request).toMatchObject({
      status: 'pending',
      type: 'interactive',
      subjectType: 'organization_member',
      redirectUri,
      state,
      nonce: 'e2e-nonce',
      codeChallenge: pkce.codeChallenge,
      codeChallengeMethod: 's256',
      scopes: ['organization:read'],
      oidcScopes: ['openid']
    });
    expect(request.oauthApplication.id).toBe(client.oauthApplication.id);
    expect(location.toString()).not.toContain(request.code);
  });

  it('infers S256 for a bare challenge and accepts a lowercase method', async () => {
    let client = await createApplication(org.ids);

    for (let method of [undefined, 's256']) {
      let pkce = createPkce();
      let response = await call(
        authorizeUrl({
          response_type: 'code',
          client_id: client.clientId,
          redirect_uri: redirectUri,
          scope: 'organization:read',
          code_challenge: pkce.codeChallenge,
          code_challenge_method: method
        })
      );

      let request = await getAuthorizationRequest(getRequestToken(response));
      expect(request.codeChallengeMethod).toBe('s256');
      expect(request.codeChallenge).toBe(pkce.codeChallenge);
    }
  });

  it('answers invalid requests with OAuth JSON errors instead of redirecting', async () => {
    let client = await createApplication(org.ids);
    let serverSide = await createApplication(org.ids, { type: 'server_side' });
    let base = {
      response_type: 'code',
      client_id: client.clientId,
      redirect_uri: redirectUri,
      scope: 'organization:read'
    };

    let cases: [Record<string, string | undefined>, number, string, RegExp?][] = [
      [{ ...base, response_type: undefined }, 400, 'invalid_request', /response_type/],
      [{ ...base, response_type: 'token' }, 400, 'unsupported_response_type'],
      [{ ...base, client_id: undefined }, 400, 'invalid_request', /client_id/],
      [{ ...base, redirect_uri: undefined }, 400, 'invalid_request', /redirect_uri/],
      [{ ...base, client_id: 'mt_oauth_unknown' }, 401, 'invalid_client'],
      [
        { ...base, redirect_uri: 'https://evil.example.com/callback' },
        400,
        'invalid_request',
        /Invalid redirect URI/
      ],
      [
        { ...base, redirect_uri: 'https://example.com/callback/other' },
        400,
        'invalid_request',
        /Invalid redirect URI/
      ],
      [
        { ...base, code_challenge: 'challenge', code_challenge_method: 'plain' },
        400,
        'invalid_request',
        /S256/
      ],
      [{ ...base, code_challenge_method: 'S256' }, 400, 'invalid_request', /code_challenge/],
      [{ ...base, subject_type: 'robot' }, 400, 'invalid_request', /subject_type/],
      [{ ...base, subject_type: 'consumer' }, 400, 'invalid_request', /subject type/],
      [{ ...base, client_id: serverSide.clientId }, 403, 'unauthorized_client']
    ];

    for (let [params, status, error, message] of cases) {
      let response = await call(authorizeUrl(params));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('content-type')).toMatch(/^application\/json/);
      expectOAuthError(response, status, error, message);
    }
  });

  it('forwards consent page tokens to the dashboard', async () => {
    let response = await call(authorizeUrl({ token: 'mtout_e2e-token' }));
    expect(response.status).toBe(302);

    let location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/oauth/authorize');
    expect(location.searchParams.get('token')).toBe('mtout_e2e-token');
  });

  it('voids the code of a denied request', async () => {
    let client = await createApplication(org.ids);
    let state = uniqueId('state');
    let response = await call(
      authorizeUrl({
        response_type: 'code',
        client_id: client.clientId,
        redirect_uri: redirectUri,
        scope: 'organization:read',
        state
      })
    );
    let urlToken = getRequestToken(response);

    let denied = await rejectRequest(client.fixture, urlToken);
    expect(denied).toMatchObject({ status: 'denied', state, redirectUri });

    let exchanged = await postToken(
      { grant_type: 'authorization_code', code: denied.code, redirect_uri: redirectUri },
      client
    );
    expect(exchanged.body.error).toBe('invalid_grant');
    expect(exchanged.body.access_token).toBeUndefined();
  });
});
