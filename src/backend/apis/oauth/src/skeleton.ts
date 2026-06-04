import { Context, cors, useRequestContext } from '@lowerdeck/hono';
import { createHono } from './lib/hono';
import { OAuthError } from './lib/errors';
import {
  getClientCredentials,
  getNumber,
  getString,
  normalizeScopes,
  parseOAuthBody
} from './lib/request';

export let createOAuthAppSkeleton = (d: {
  oauth: {
    token: (
      d: {
        context: ReturnType<typeof useRequestContext>;
        credentials: ReturnType<typeof getClientCredentials>;
        grantType: string;
        code?: string;
        redirectUri?: string;
        clientSecret?: string;
        codeVerifier?: string;
        deviceCode?: string;
        refreshToken?: string;
        expiresIn?: number;
        scope?: string[];
      },
      c: Context
    ) => Promise<Response>;

    authorize: (
      d:
        | {
            type: 'token';
            context: ReturnType<typeof useRequestContext>;
            token: string;
          }
        | {
            type: 'code';
            context: ReturnType<typeof useRequestContext>;
            responseType: string;
            clientId: string;
            redirectUri: string;
            codeChallenge?: string;
            codeChallengeMethod?: 's256' | 'none';
            state?: string;
            nonce?: string;
            scopes?: string[];
          },
      c: Context
    ) => Promise<Response>;

    deviceAuthorization: (
      d: {
        context: ReturnType<typeof useRequestContext>;
        credentials: ReturnType<typeof getClientCredentials>;
        scopes: string[];
      },
      c: Context
    ) => Promise<Response>;

    openIdConfiguration: (
      d: { context: ReturnType<typeof useRequestContext> },
      c: Context
    ) => Promise<Response>;
    oauthProtectedResourceMetadata: (
      d: { context: ReturnType<typeof useRequestContext> },
      c: Context
    ) => Promise<Response>;
    oauthAuthorizationServerMetadata: (
      d: { context: ReturnType<typeof useRequestContext> },
      c: Context
    ) => Promise<Response>;
    jwks: (
      d: { context: ReturnType<typeof useRequestContext> },
      c: Context
    ) => Promise<Response>;
    userinfo: (
      d: {
        context: ReturnType<typeof useRequestContext>;
        accessToken: string;
      },
      c: Context
    ) => Promise<Response>;
  };

  cli: {
    authStart: (
      d: { context: ReturnType<typeof useRequestContext> },
      c: Context
    ) => Promise<Response>;

    authComplete: (d: { token: string }, c: Context) => Promise<Response>;
  };
}) =>
  createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type', 'metorial-version'],
        credentials: false
      })
    )
    .post('/oauth/token', async c => {
      let context = useRequestContext(c);
      let body = await parseOAuthBody(c);
      let credentials = getClientCredentials(c, body);

      let grantType = getString(body.grant_type);
      let code = getString(body.code);
      let redirectUri = getString(body.redirect_uri);
      let codeVerifier = getString(body.code_verifier);
      let deviceCode = getString(body.device_code);
      let refreshToken = getString(body.refresh_token);
      let expiresIn = getNumber(body.expires_in);
      let scope = normalizeScopes(body.scope ?? body.scopes);

      if (!grantType) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'grant_type is required'
        });
      }

      if (!credentials.clientId) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'client_id is required'
        });
      }

      if (grantType == 'client_credentials' && !credentials.clientSecret) {
        throw new OAuthError({
          error: 'invalid_client',
          status: 401,
          errorMessage: 'A client secret is required for this client'
        });
      }

      return await d.oauth.token(
        {
          context,
          credentials,
          grantType,
          code,
          redirectUri,
          clientSecret: credentials.clientSecret,
          codeVerifier,
          deviceCode,
          refreshToken,
          expiresIn,
          scope
        },
        c
      );
    })
    .post('/cli/auth/start', async c => {
      let context = useRequestContext(c);

      return await d.cli.authStart({ context }, c);
    })
    .post('/cli/auth/complete', async c => {
      let body = await parseOAuthBody(c);
      let token = getString(body.token);

      if (!token) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'token is required'
        });
      }

      return await d.cli.authComplete({ token }, c);
    })
    .post('/oauth/device_authorization', async c => {
      let context = useRequestContext(c);

      let body = await parseOAuthBody(c);
      let credentials = getClientCredentials(c, body);

      if (!credentials.clientId) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'client_id is required'
        });
      }

      return await d.oauth.deviceAuthorization(
        {
          context,
          credentials,
          scopes: normalizeScopes(body.scope) ?? []
        },
        c
      );
    })
    .get('/oauth/authorize', async c => {
      let context = useRequestContext(c);

      let token = getString(c.req.query('token'));
      if (token) {
        return await d.oauth.authorize(
          {
            type: 'token',
            context,
            token
          },
          c
        );
      }

      let responseType = getString(c.req.query('response_type'));
      let clientId = getString(c.req.query('client_id'));
      let redirectUri = getString(c.req.query('redirect_uri'));
      let codeChallenge = getString(c.req.query('code_challenge'));
      let codeChallengeMethod = getString(c.req.query('code_challenge_method'));
      let state = getString(c.req.query('state'));
      let nonce = getString(c.req.query('nonce'));
      let scopes = normalizeScopes(c.req.query('scope') || c.req.query('scopes'));

      if (!responseType) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'response_type is required'
        });
      }

      if (responseType != 'code') {
        throw new OAuthError({
          error: 'unsupported_response_type',
          errorMessage: 'Only response_type=code is supported'
        });
      }

      if (!clientId) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'client_id is required'
        });
      }

      if (!redirectUri) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'redirect_uri is required'
        });
      }

      if (codeChallengeMethod && codeChallengeMethod != 'none' && !codeChallenge) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'code_challenge is required when code_challenge_method is provided'
        });
      }

      if (codeChallengeMethod == 's256') codeChallengeMethod = 'S256';

      if (codeChallengeMethod && codeChallengeMethod != 'S256') {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'Only S256 PKCE challenges are supported'
        });
      }

      if (codeChallenge && !codeChallengeMethod) codeChallengeMethod = 'S256';

      return await d.oauth.authorize(
        {
          type: 'code',
          context,
          responseType,
          clientId,
          redirectUri,
          codeChallenge,
          codeChallengeMethod: codeChallengeMethod === 'S256' ? 's256' : 'none',
          state,
          nonce,
          scopes
        },
        c
      );
    })
    .get('/.well-known/openid-configuration', async c => {
      let context = useRequestContext(c);
      return await d.oauth.openIdConfiguration({ context }, c);
    })
    .get('/.well-known/oauth-protected-resource', async c => {
      let context = useRequestContext(c);
      return await d.oauth.oauthProtectedResourceMetadata({ context }, c);
    })
    .get('/.well-known/oauth-authorization-server', async c => {
      let context = useRequestContext(c);
      return await d.oauth.oauthAuthorizationServerMetadata({ context }, c);
    })
    .get('/oauth/jwks', async c => {
      let context = useRequestContext(c);
      return await d.oauth.jwks({ context }, c);
    })
    .get('/oauth/userinfo', async c => {
      let context = useRequestContext(c);
      let authorization = c.req.header('authorization');
      let accessToken = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : undefined;

      if (!accessToken) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'Missing bearer access token'
        });
      }

      return await d.oauth.userinfo(
        {
          context,
          accessToken
        },
        c
      );
    }) as {
    fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  };
