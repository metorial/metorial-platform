import {
  eventually,
  expectOk,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { oauthApplicationService } from '@metorial/module-machine-access';
import { createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  authorizeAndConsent,
  basicAuth,
  call,
  createApplication,
  decodeJwt,
  expectOAuthError,
  issueTokens,
  postForm,
  postToken,
  redirectUri
} from './_fixtures';

describe('api-oauth token', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let tokenApi = (accessToken: string) =>
    rest(metorialEndpoints().api, { apiKey: accessToken });

  let userinfo = (accessToken: string) =>
    call('/oauth/userinfo', { headers: { authorization: `Bearer ${accessToken}` } });

  it('exchanges an authorization code for tokens that authenticate against the API', async () => {
    let client = await createApplication(org.ids);
    let authorization = await authorizeAndConsent(client);

    let response = await postToken(authorization.codeGrant, client);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    expect(response.body).toMatchObject({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      token_type: 'Bearer',
      scope: 'organization:read',
      subject_type: 'organization_member',
      user: { id: org.ids.userId },
      organization: { id: org.ids.organizationId }
    });
    expect(response.body.expires_in).toBeGreaterThan(3000);
    expect(response.body.expires_in).toBeLessThanOrEqual(3600);
    expect(response.body.id_token).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(client.clientSecret);

    let organization = expectOk(
      await tokenApi(response.body.access_token).get('/organization')
    );
    expect(organization.id).toBe(org.ids.organizationId);
    expect(
      (await tokenApi(`${response.body.access_token}x`).get('/organization')).status
    ).toBe(401);

    let info = await userinfo(response.body.access_token);
    expect(info.status).toBe(200);
    expect(info.body).toEqual({ sub: org.ids.userId });
  });

  it('marks token responses and token errors as not cacheable', async () => {
    let client = await createApplication(org.ids);
    let authorization = await authorizeAndConsent(client);

    let success = await postToken(authorization.codeGrant, client);
    let failure = await postToken(authorization.codeGrant, client);
    let device = await postForm(
      '/oauth/device_authorization',
      { scope: 'organization:read' },
      { authorization: basicAuth(client.clientId, client.clientSecret) }
    );

    expect(success.status).toBe(200);
    expect(device.status).toBe(200);
    expect(failure.body.error).toBe('invalid_grant');
    for (let response of [success, failure, device]) {
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('pragma')).toBe('no-cache');
    }
  });

  it('accepts client credentials in the form body and JSON bodies', async () => {
    let client = await createApplication(org.ids);

    let form = await authorizeAndConsent(client);
    let formResponse = await postForm('/oauth/token', {
      ...form.codeGrant,
      client_id: client.clientId,
      client_secret: client.clientSecret
    });
    expect(formResponse.status).toBe(200);

    let json = await authorizeAndConsent(client);
    let jsonResponse = await call('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...json.codeGrant,
        client_id: client.clientId,
        client_secret: client.clientSecret
      })
    });
    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.body.access_token).not.toBe(formResponse.body.access_token);
  });

  it('issues OpenID id tokens signed with a published key', async () => {
    let client = await createApplication(org.ids);
    let nonce = uniqueId('nonce');
    let { tokens } = await issueTokens(client, {
      scope: 'openid profile email organization:read',
      nonce
    });
    expect(tokens.scope.split(' ')).toEqual(
      expect.arrayContaining(['openid', 'profile', 'email', 'organization:read'])
    );

    let idToken = decodeJwt(tokens.id_token);
    let issuer = (await call('/.well-known/openid-configuration')).body.issuer;
    expect(idToken.header).toMatchObject({ alg: 'ES256', typ: 'JWT' });
    expect(idToken.payload).toMatchObject({
      iss: issuer,
      sub: org.ids.userId,
      aud: client.clientId,
      nonce
    });
    expect(idToken.payload.exp).toBeGreaterThan(Date.now() / 1000);

    let jwks = (await call('/oauth/jwks')).body.keys;
    let jwk = jwks.find((key: { kid: string }) => key.kid == idToken.header.kid);
    expect(jwk).toBeDefined();
    let publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    expect(
      verify(
        'sha256',
        Buffer.from(idToken.signingInput),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        idToken.signature
      )
    ).toBe(true);

    let info = await userinfo(tokens.access_token);
    expect(info.body).toMatchObject({
      sub: org.ids.userId,
      email: expect.any(String),
      email_verified: true
    });
  });

  it('narrows the granted scopes to the requested ones', async () => {
    let client = await createApplication(org.ids, {
      scopes: ['organization:read', 'organization.member:read']
    });

    let { tokens } = await issueTokens(client, { scope: 'organization:read' });
    expect(tokens.scope).toBe('organization:read');

    let response = await call(
      `/oauth/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: client.clientId,
        redirect_uri: redirectUri,
        scope: 'organization:write'
      })}`
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
  });

  it('redeems an authorization code only once', async () => {
    let client = await createApplication(org.ids);
    let authorization = await authorizeAndConsent(client);

    let first = await postToken(authorization.codeGrant, client);
    expect(first.status).toBe(200);

    let second = await postToken(authorization.codeGrant, client);
    expect(second.body.error).toBe('invalid_grant');
    expect(second.body.access_token).toBeUndefined();
  });

  it('verifies the PKCE code verifier', async () => {
    let client = await createApplication(org.ids);
    let authorization = await authorizeAndConsent(client);

    expectOAuthError(
      await postToken({ ...authorization.codeGrant, code_verifier: undefined }, client),
      400,
      'invalid_grant',
      /code verifier is required/
    );
    expectOAuthError(
      await postToken(
        { ...authorization.codeGrant, code_verifier: `${authorization.codeVerifier}x` },
        client
      ),
      400,
      'invalid_grant',
      /Invalid PKCE code verifier/
    );

    let response = await postToken(authorization.codeGrant, client);
    expect(response.status).toBe(200);

    let plain = await authorizeAndConsent(client, { pkce: false });
    expectOAuthError(
      await postToken({ ...plain.codeGrant, code_verifier: 'unexpected-verifier' }, client),
      400,
      'invalid_grant',
      /not allowed/
    );
  });

  it('binds the code to its client and redirect URI', async () => {
    let client = await createApplication(org.ids);
    let otherClient = await createApplication(org.ids);
    let authorization = await authorizeAndConsent(client);

    let stolen = await postToken(authorization.codeGrant, otherClient);
    expect(stolen.body.error).toBe('invalid_grant');

    expectOAuthError(
      await postToken(
        { ...authorization.codeGrant, redirect_uri: 'https://example.com/elsewhere' },
        client
      ),
      400,
      'invalid_grant',
      /Redirect URI does not match/
    );

    let response = await postToken(authorization.codeGrant, client);
    expect(response.status).toBe(200);
  });

  it('authenticates the client on the token endpoint', async () => {
    let client = await createApplication(org.ids);
    let authorization = await authorizeAndConsent(client);
    let grant = authorization.codeGrant;

    expectOAuthError(
      await postToken(grant, { ...client, clientSecret: `${client.clientSecret}x` }),
      401,
      'invalid_client'
    );
    expectOAuthError(
      await postForm('/oauth/token', { ...grant, client_id: client.clientId }),
      401,
      'invalid_client',
      /client secret is required/
    );
    expectOAuthError(
      await postForm(
        '/oauth/token',
        { ...grant, client_id: 'mt_oauth_other' },
        { authorization: basicAuth(client.clientId, client.clientSecret) }
      ),
      401,
      'invalid_client',
      /Conflicting/
    );
    expectOAuthError(
      await postForm(
        '/oauth/token',
        { ...grant },
        { authorization: `Basic ${Buffer.from('no-separator').toString('base64')}` }
      ),
      401,
      'invalid_client',
      /basic authorization/
    );
    expectOAuthError(
      await postToken(grant, {
        clientId: 'mt_oauth_unknown',
        clientSecret: client.clientSecret
      }),
      401,
      'invalid_client'
    );

    let response = await postToken(grant, client);
    expect(response.status).toBe(200);
  });

  it('exchanges codes without a secret only for secretless applications', async () => {
    let client = await createApplication(org.ids, {
      allowClientSecretlessTokenExchange: true
    });
    let authorization = await authorizeAndConsent(client);

    let response = await postForm('/oauth/token', {
      ...authorization.codeGrant,
      client_id: client.clientId
    });
    expect(response.status).toBe(200);
    expect(response.body.access_token).toEqual(expect.any(String));
    expect(response.body.refresh_token).toBeUndefined();
  });

  it('rotates refresh tokens and retires the previous access token', async () => {
    let client = await createApplication(org.ids);
    let { tokens } = await issueTokens(client);

    let refreshed = await postToken(
      { grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
      client
    );
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).not.toBe(tokens.access_token);
    expect(refreshed.body.refresh_token).not.toBe(tokens.refresh_token);
    expect(refreshed.body.scope).toBe('organization:read');

    expect(expectOk(await tokenApi(refreshed.body.access_token).get('/organization')).id).toBe(
      org.ids.organizationId
    );
    await eventually(async () => {
      expect((await tokenApi(tokens.access_token).get('/organization')).status).toBe(401);
    });

    let reused = await postToken(
      { grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
      client
    );
    expect(reused.body.error).toBe('invalid_grant');

    let otherClient = await createApplication(org.ids);
    let foreign = await postToken(
      { grant_type: 'refresh_token', refresh_token: refreshed.body.refresh_token },
      otherClient
    );
    expect(foreign.body.error).toBe('invalid_grant');

    let tooSoon = await postToken(
      { grant_type: 'refresh_token', refresh_token: refreshed.body.refresh_token },
      client
    );
    expect(tooSoon.body).toMatchObject({
      error: 'invalid_grant',
      error_message: expect.stringMatching(/once every 10 minutes/)
    });
  });

  it('requires client authentication to refresh tokens of confidential clients', async () => {
    let client = await createApplication(org.ids);
    let { tokens } = await issueTokens(client);

    let response = await postForm('/oauth/token', {
      grant_type: 'refresh_token',
      client_id: client.clientId,
      refresh_token: tokens.refresh_token
    });
    expectOAuthError(response, 401, 'invalid_client');
  });

  it('stops authenticating tokens once their authorization is revoked', async () => {
    let client = await createApplication(org.ids);
    let { tokens, accepted } = await issueTokens(client);
    let authorizationId = accepted.oauthAuthorization.id;
    let path = `/organization/oauth/authorizations/${authorizationId}`;

    expect((await otherOrg.clients.management.post(`${path}/revoke`)).status).toBe(404);
    expect((await tokenApi(tokens.access_token).get('/organization')).status).toBe(200);

    let revoked = expectOk(await org.clients.management.post(`${path}/revoke`));
    expect(revoked.status).toBe('revoked');

    await eventually(async () => {
      expect((await tokenApi(tokens.access_token).get('/organization')).status).toBe(401);
    });
    expect((await userinfo(tokens.access_token)).status).toBe(401);

    let refresh = await postToken(
      { grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
      client
    );
    expect(refresh.status).toBe(401);
    expect(refresh.body.access_token).toBeUndefined();
  });

  it('never exposes tokens, codes or client secrets in presented resources', async () => {
    let client = await createApplication(org.ids);
    let { tokens, code, accepted } = await issueTokens(client);

    let authorizations = await listAll(
      org.clients.management,
      '/organization/oauth/authorizations',
      { query: { app_id: client.oauthApplication.id } }
    );
    expect(authorizations.map(item => item.id)).toContain(accepted.oauthAuthorization.id);

    let application = expectOk(
      await org.clients.management.get(
        `/organization/oauth/apps/${client.oauthApplication.id}`
      )
    );
    let installations = await listAll(
      org.clients.management,
      '/organization/oauth/installations',
      { query: { app_id: client.oauthApplication.id } }
    );

    let presented = JSON.stringify([authorizations, application, installations]);
    for (let secret of [
      tokens.access_token,
      tokens.refresh_token,
      code,
      client.clientSecret
    ]) {
      expect(presented).not.toContain(secret);
    }
  });

  it('issues client credentials tokens to server-side applications', async () => {
    let client = await createApplication(org.ids, { type: 'server_side' });
    let grant = { grant_type: 'client_credentials', scope: 'organization:read' };

    let response = await postToken({ ...grant, expires_in: '120' }, client);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      access_token: expect.any(String),
      token_type: 'Bearer',
      scope: 'organization:read'
    });
    expect(response.body.refresh_token).toBeUndefined();
    expect(response.body.expires_in).toBeGreaterThan(100);
    expect(response.body.expires_in).toBeLessThanOrEqual(120);
    expect((await userinfo(response.body.access_token)).status).toBe(200);

    for (let expiresIn of ['0', '-5', '1.5']) {
      expectOAuthError(
        await postToken({ ...grant, expires_in: expiresIn }, client),
        400,
        'invalid_request',
        /expires_in/
      );
    }
    expectOAuthError(
      await postToken({ ...grant, expires_in: '10' }, client),
      400,
      'invalid_request',
      /expires_in must be between/
    );
    expectOAuthError(
      await postForm('/oauth/token', { ...grant, client_id: client.clientId }),
      401,
      'invalid_client'
    );
    expectOAuthError(
      await postToken(grant, { ...client, clientSecret: 'mt_oauth_secret_wrong' }),
      401,
      'invalid_client'
    );
  });

  it('validates token requests', async () => {
    let client = await createApplication(org.ids);
    let cases: [Record<string, string | undefined>, number, string, RegExp?][] = [
      [{}, 400, 'invalid_request', /grant_type/],
      [{ grant_type: 'password' }, 400, 'unsupported_grant_type'],
      [
        { grant_type: 'authorization_code', redirect_uri: redirectUri },
        400,
        'invalid_request',
        /code is required/
      ],
      [
        { grant_type: 'authorization_code', code: 'metorial_oauth_token_x' },
        400,
        'invalid_request',
        /redirect_uri is required/
      ],
      [{ grant_type: 'refresh_token' }, 400, 'invalid_request', /refresh_token is required/],
      [
        { grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
        400,
        'invalid_request',
        /device_code is required/
      ]
    ];

    for (let [body, status, error, message] of cases) {
      expectOAuthError(await postToken(body, client), status, error, message);
    }

    expectOAuthError(
      await postForm('/oauth/token', { grant_type: 'client_credentials' }),
      400,
      'invalid_request',
      /client_id is required/
    );

    let textBody = await call('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'grant_type=client_credentials'
    });
    expectOAuthError(textBody, 400, 'invalid_request', /grant_type is required/);

    let brokenJson = await call('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"grant_type":'
    });
    expectOAuthError(brokenJson, 400, 'invalid_request', /Failed to parse/);
  });

  it.fails(
    'answers invalid_grant with 400 (bug: machine-access throws unauthorizedError for unknown or reused codes and refresh tokens)',
    async () => {
      let client = await createApplication(org.ids);
      let authorization = await authorizeAndConsent(client);
      expect((await postToken(authorization.codeGrant, client)).status).toBe(200);

      for (let response of [
        await postToken(authorization.codeGrant, client),
        await postToken(
          { ...authorization.codeGrant, code: 'metorial_oauth_token_unknown' },
          client
        ),
        await postToken({ grant_type: 'refresh_token', refresh_token: 'unknown' }, client)
      ]) {
        expectOAuthError(response, 400, 'invalid_grant');
      }
    }
  );

  it.fails(
    'uses OAuth error codes for scope and client-type failures (bug: machine-access throws plain bad_request/forbidden errors without an oauth payload)',
    async () => {
      let serverSide = await createApplication(org.ids, { type: 'server_side' });
      expectOAuthError(
        await postToken(
          { grant_type: 'client_credentials', scope: 'organization.member:read' },
          serverSide
        ),
        400,
        'invalid_scope'
      );

      let userFacing = await createApplication(org.ids);
      expectOAuthError(
        await postToken({ grant_type: 'client_credentials' }, userFacing),
        400,
        'unauthorized_client'
      );
    }
  );

  it('rejects tokens of archived applications', async () => {
    let client = await createApplication(org.ids);
    let { tokens } = await issueTokens(client);

    await oauthApplicationService.archiveOAuthApplication({
      oauthApplication: client.oauthApplication,
      organization: client.fixture.organization,
      auditScope: client.fixture.auditScope
    });

    await eventually(async () => {
      expect((await tokenApi(tokens.access_token).get('/organization')).status).toBe(401);
    });
    expectOAuthError(
      await postToken(
        { grant_type: 'refresh_token', refresh_token: tokens.refresh_token },
        client
      ),
      401,
      'invalid_client'
    );
  });
});
