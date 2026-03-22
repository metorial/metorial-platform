import { cors, useRequestContext } from '@lowerdeck/hono';
import { getConfig } from '@metorial/config';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { OAuthError } from './lib/errors';
import { getExpiresIn } from './lib/expiration';
import { createHono } from './lib/hono';
import {
  ensureOptionalClientSecretIsValid,
  getClientCredentials,
  getNumber,
  getString,
  normalizeScopes,
  parseOAuthBody
} from './lib/request';

export let oauthApi = createHono()
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

    if (
      (grantType == 'client_credentials' ||
        grantType == 'urn:ietf:params:oauth:grant-type:device_code' ||
        grantType == 'device_code' ||
        grantType == 'authorization_code') &&
      !credentials.clientSecret
    ) {
      throw new OAuthError({
        error: 'invalid_client',
        status: 401,
        errorMessage: 'A client secret is required for this client'
      });
    }

    await ensureOptionalClientSecretIsValid({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret
    });

    let response = null as Awaited<
      ReturnType<typeof oauthAuthorizationService.exchangeOAuthToken>
    > | null;

    if (grantType == 'authorization_code') {
      if (!code) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'code is required for the authorization_code grant'
        });
      }

      if (!redirectUri) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'redirect_uri is required for the authorization_code grant'
        });
      }

      response = await oauthAuthorizationService.exchangeOAuthToken({
        context,
        input: {
          grantType,
          clientId: credentials.clientId,
          code,
          redirectUri,
          codeVerifier
        }
      });
    } else if (
      grantType == 'urn:ietf:params:oauth:grant-type:device_code' ||
      grantType == 'device_code'
    ) {
      if (!deviceCode) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'device_code is required for the device code grant'
        });
      }

      response = await oauthAuthorizationService.exchangeOAuthToken({
        context,
        input: {
          grantType,
          clientId: credentials.clientId,
          deviceCode
        }
      });
    } else if (grantType == 'client_credentials') {
      if (expiresIn !== undefined && (!Number.isInteger(expiresIn) || expiresIn <= 0)) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'expires_in must be a positive integer'
        });
      }

      response = await oauthAuthorizationService.exchangeOAuthToken({
        context,
        input: {
          grantType,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret!,
          scopes: scope ?? [],
          expiresIn
        }
      });
    } else if (grantType == 'refresh_token') {
      if (!refreshToken) {
        throw new OAuthError({
          error: 'invalid_request',
          errorMessage: 'refresh_token is required for the refresh_token grant'
        });
      }

      response = await oauthAuthorizationService.exchangeOAuthToken({
        context,
        input: {
          grantType,
          clientId: credentials.clientId,
          refreshToken: refreshToken
        }
      });
    } else {
      throw new OAuthError({
        error: 'unsupported_grant_type',
        errorMessage: `Unsupported grant type: ${grantType}`
      });
    }

    if (!response) {
      throw new OAuthError({
        error: 'server_error',
        status: 500,
        errorMessage: 'OAuth token exchange did not return a response'
      });
    }

    return c.json({
      access_token: response.oauthToken.accessToken,
      token_type: 'Bearer',
      expires_in: getExpiresIn(response.oauthToken.accessTokenExpiresAt),
      refresh_token: response.oauthToken.refreshToken ?? undefined,
      scope: response.oauthAuthorization.scopes.join(' ') || undefined,

      user: response.oauthAuthorization.user
        ? {
            id: response.oauthAuthorization.user.id,
            name: response.oauthAuthorization.user.name,
            email: response.oauthAuthorization.user.email
          }
        : null,

      organization: response.oauthInstallation.organization
        ? {
            id: response.oauthInstallation.organization.id,
            name: response.oauthInstallation.organization.name
          }
        : null
    });
  })
  .post('/cli/auth/start', async c => {
    let context = useRequestContext(c);

    let oauthAuthorizationRequest =
      await oauthAuthorizationService.createCliAuthAuthorizationRequest({ context });

    let authorizationUrl = new URL(`/oauth/authorize`, getConfig().urls.apiUrl);
    authorizationUrl.searchParams.set('token', oauthAuthorizationRequest.urlToken);

    return c.json({
      id: oauthAuthorizationRequest.id,
      token: oauthAuthorizationRequest.deviceCode,
      expires_in: getExpiresIn(oauthAuthorizationRequest.expiresAt),
      interval: 5,
      user_code: oauthAuthorizationRequest.userCode,
      authorization_url: authorizationUrl.toString()
    });
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

    let response = await oauthAuthorizationService.exchangeCliAuthToken({
      token
    });

    return c.json({
      access_token: response.oauthToken.accessToken,
      expires_in: getExpiresIn(response.oauthToken.accessTokenExpiresAt),
      refresh_token: response.oauthToken.refreshToken ?? undefined,
      scope: response.oauthAuthorization.scopes,
      client_id: response.oauthAuthorization.oauthApplication.clientId,

      user: response.oauthAuthorization.user
        ? {
            id: response.oauthAuthorization.user.id,
            name: response.oauthAuthorization.user.name,
            email: response.oauthAuthorization.user.email
          }
        : null,

      organization: response.oauthInstallation.organization
        ? {
            id: response.oauthInstallation.organization.id,
            name: response.oauthInstallation.organization.name
          }
        : null
    });
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

    await ensureOptionalClientSecretIsValid({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret
    });

    let oauthAuthorizationRequest =
      await oauthAuthorizationService.createOAuthAuthorizationRequest({
        context,
        input: {
          type: 'device_code',
          clientId: credentials.clientId,
          clientIp: context.ip,
          scopes: normalizeScopes(body.scope) ?? []
        }
      });

    let verificationUrl = new URL(`/oauth/authorize`, getConfig().urls.apiUrl);
    verificationUrl.searchParams.set('token', oauthAuthorizationRequest.urlToken);

    return c.json({
      device_code: oauthAuthorizationRequest.deviceCode,
      user_code: oauthAuthorizationRequest.userCode,
      verification_uri: verificationUrl,
      verification_uri_complete: verificationUrl,
      expires_in: getExpiresIn(oauthAuthorizationRequest.expiresAt),
      interval: 5,
      scope: oauthAuthorizationRequest.scopes.join(' ') || undefined
    });
  })
  .get('/oauth/authorize', async c => {
    let context = useRequestContext(c);

    let token = c.req.query('token');
    if (token) {
      let authUrl = new URL(`/oauth/authorize`, getConfig().urls.appUrl);
      authUrl.searchParams.set('token', token);
      return c.redirect(authUrl, 302);
    }

    let responseType = getString(c.req.query('response_type'));
    let clientId = getString(c.req.query('client_id'));
    let redirectUri = getString(c.req.query('redirect_uri'));
    let codeChallenge = getString(c.req.query('code_challenge'));
    let codeChallengeMethod = getString(c.req.query('code_challenge_method'));
    let state = getString(c.req.query('state'));
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

    if (codeChallenge && !codeChallengeMethod) codeChallengeMethod = 'S256';
    if (codeChallengeMethod === 's256') codeChallengeMethod = 'S256';

    if (codeChallengeMethod && !codeChallenge) {
      throw new OAuthError({
        error: 'invalid_request',
        errorMessage: 'code_challenge is required when code_challenge_method is provided'
      });
    }

    if (codeChallengeMethod && codeChallengeMethod != 'S256') {
      throw new OAuthError({
        error: 'invalid_request',
        errorMessage: 'Only S256 PKCE challenges are supported'
      });
    }

    let oauthAuthorizationRequest =
      await oauthAuthorizationService.createOAuthAuthorizationRequest({
        context,
        input: {
          type: 'interactive',
          clientId,
          redirectUri,
          scopes: normalizeScopes(scopes) ?? [],
          state: getString(state),
          codeChallengeMethod: codeChallenge ? 's256' : 'none',
          codeChallenge
        }
      });

    let verificationUrl = new URL(`/oauth/authorize`, getConfig().urls.appUrl);
    verificationUrl.searchParams.set('token', oauthAuthorizationRequest.urlToken);

    return c.redirect(verificationUrl, 302);
  });
