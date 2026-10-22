import { testContext, uniqueId } from '@metorial/e2e';
import { loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import {
  oauthApplicationService,
  oauthAuthorizationService
} from '@metorial/module-machine-access';
import { createHash, randomBytes } from 'node:crypto';
import { oauthApi } from '../src';

export let redirectUri = 'https://example.com/callback';

export type OAuthResponse = {
  status: number;
  headers: Headers;
  body: any;
};

export type OAuthClient = Awaited<ReturnType<typeof createApplication>>;

export let call = async (path: string, init: RequestInit = {}): Promise<OAuthResponse> => {
  let response = await oauthApi.fetch(new Request(`http://localhost${path}`, init));
  let text = await response.text();

  let body: any = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {}

  return { status: response.status, headers: response.headers, body };
};

export let basicAuth = (clientId: string, clientSecret: string) =>
  `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

export let postForm = (
  path: string,
  body: Record<string, string | undefined>,
  headers: Record<string, string> = {}
) => {
  let params = new URLSearchParams();
  for (let [key, value] of Object.entries(body)) {
    if (value !== undefined) params.set(key, value);
  }

  return call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: params.toString()
  });
};

export let postToken = (
  body: Record<string, string | undefined>,
  client?: { clientId: string; clientSecret: string }
) =>
  postForm(
    '/oauth/token',
    body,
    client ? { authorization: basicAuth(client.clientId, client.clientSecret) } : {}
  );

export let expectOAuthError = (
  response: OAuthResponse,
  status: number,
  error: string,
  message?: RegExp
) => {
  if (response.status != status || response.body?.error != error) {
    throw new Error(
      `Expected ${status} ${error}, got ${response.status}: ${JSON.stringify(response.body)}`
    );
  }
  if (message) {
    if (!message.test(response.body.error_message ?? '')) {
      throw new Error(
        `Expected error_message to match ${message}, got ${response.body.error_message}`
      );
    }
  }

  return response.body;
};

export let createPkce = () => {
  let codeVerifier = randomBytes(32).toString('base64url');
  let codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  return { codeVerifier, codeChallenge };
};

export let createApplication = async (
  ids: { organizationId: string },
  input: {
    type?: 'user_facing' | 'server_side';
    scopes?: string[];
    redirectUris?: string[];
    allowClientSecretlessTokenExchange?: boolean;
  } = {}
) => {
  let fixture = await loadOrganizationFixture(ids);
  let type = input.type ?? 'user_facing';

  let oauthApplication = await oauthApplicationService.createOAuthApplication({
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: {
      type,
      accessLevel: 'organization',
      name: uniqueId('oauth-api-app'),
      redirectUris: type == 'user_facing' ? (input.redirectUris ?? [redirectUri]) : undefined,
      scopes: input.scopes ?? ['organization:read'],
      allowClientSecretlessTokenExchange: input.allowClientSecretlessTokenExchange
    }
  });
  let { secret } = await oauthApplicationService.createOAuthApplicationClientSecret({
    oauthApplication,
    auditScope: fixture.auditScope
  });

  return {
    fixture,
    oauthApplication,
    clientId: oauthApplication.clientId,
    clientSecret: secret
  };
};

export let authorizeUrl = (params: Record<string, string | undefined>) => {
  let query = new URLSearchParams();
  for (let [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }

  return `/oauth/authorize?${query.toString()}`;
};

export let getRequestToken = (response: OAuthResponse) => {
  let location = response.headers.get('location');
  if (response.status != 302 || !location) {
    throw new Error(
      `Expected a consent redirect, got ${response.status}: ${JSON.stringify(response.body)}`
    );
  }

  let token = new URL(location).searchParams.get('token');
  if (!token) throw new Error(`The consent redirect has no token: ${location}`);

  return token;
};

export let getAuthorizationRequest = (urlToken: string) =>
  oauthAuthorizationService.getOAuthAuthorizationRequestByUrlToken({ urlToken });

export let acceptRequest = async (fixture: OrganizationFixture, urlToken: string) =>
  await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
    oauthAuthorizationRequest: await getAuthorizationRequest(urlToken),
    user: fixture.user,
    organizationId: fixture.organization.id,
    context: testContext()
  });

export let rejectRequest = async (fixture: OrganizationFixture, urlToken: string) =>
  await oauthAuthorizationService.rejectOAuthAuthorizationRequest({
    oauthAuthorizationRequest: await getAuthorizationRequest(urlToken),
    user: fixture.user,
    organizationId: fixture.organization.id,
    context: testContext()
  });

export let authorizeAndConsent = async (
  client: OAuthClient,
  params: { scope?: string; state?: string; nonce?: string; pkce?: boolean } = {}
) => {
  let pkce = params.pkce === false ? null : createPkce();
  let state = params.state ?? uniqueId('state');

  let response = await call(
    authorizeUrl({
      response_type: 'code',
      client_id: client.clientId,
      redirect_uri: redirectUri,
      scope: params.scope ?? 'organization:read',
      state,
      nonce: params.nonce,
      code_challenge: pkce?.codeChallenge,
      code_challenge_method: pkce ? 'S256' : undefined
    })
  );
  let urlToken = getRequestToken(response);
  let accepted = await acceptRequest(client.fixture, urlToken);

  return {
    state,
    urlToken,
    code: accepted.oauthAuthorizationRequest.code,
    codeVerifier: pkce?.codeVerifier,
    accepted,
    codeGrant: {
      grant_type: 'authorization_code',
      code: accepted.oauthAuthorizationRequest.code,
      redirect_uri: redirectUri,
      code_verifier: pkce?.codeVerifier
    }
  };
};

export let issueTokens = async (
  client: OAuthClient,
  params: Parameters<typeof authorizeAndConsent>[1] = {}
) => {
  let authorization = await authorizeAndConsent(client, params);
  let response = await postToken(authorization.codeGrant, client);
  if (response.status != 200) {
    throw new Error(
      `Token exchange failed (${response.status}): ${JSON.stringify(response.body)}`
    );
  }

  return { ...authorization, tokens: response.body };
};

export let decodeJwt = (jwt: string) => {
  let [header, payload, signature] = jwt.split('.');

  return {
    header: JSON.parse(Buffer.from(header!, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')),
    signingInput: `${header}.${payload}`,
    signature: Buffer.from(signature!, 'base64url')
  };
};
