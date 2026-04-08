import { useValidatedBody } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { AuthInfo } from '@metorial/module-access';
import {
  consumerOAuthService,
  portalAccessTokenTtlSeconds,
  portalRefreshTokenTtlSeconds
} from '@metorial/module-portal';
import { Authenticator } from '@metorial/rest';
import { getMagicMcpTokenSecretFromRequest, handleMagicMcpRequest } from './magic';
import { createOAuthHono } from './oauth/hono';
import { getClientCredentials, getString, parseOAuthBody } from './oauth/utils';

export let createPortalHandler = (d: {
  authenticate: Authenticator<AuthInfo>;
}): {
  metadataServer: ReturnType<typeof createOAuthHono>;
  connectPortalServer: ReturnType<typeof createOAuthHono>;
} => {
  let buildPortalOAuthClientRegistration = (d: {
    registration: {
      id: string;
      clientId: string;
      clientSecret: string | null;
      redirectUris: string[];
      name: string;
      tokenEndpointAuthMethod: 'client_secret_basic' | 'client_secret_post' | 'none';
      createdAt: Date;
      expiresAt: Date;
    };
    base: string;
  }) => ({
    client_id: d.registration.clientId,
    client_secret: d.registration.clientSecret ?? undefined,
    redirect_uris: d.registration.redirectUris,
    client_name: d.registration.name,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: d.registration.tokenEndpointAuthMethod,
    registration_client_uri: `${d.base}/oauth/register/${d.registration.id}`,
    client_id_issued_at: Math.floor(d.registration.createdAt.getTime() / 1000),
    client_secret_expires_at:
      d.registration.clientSecret == null
        ? 0
        : Math.floor(d.registration.expiresAt.getTime() / 1000),
    client_secret_issued_at:
      d.registration.clientSecret == null
        ? undefined
        : Math.floor(d.registration.createdAt.getTime() / 1000)
  });

  let getProtectedResource = (base: string) => ({
    resource: `${base}`,
    authorization_servers: [base],
    bearer_methods_supported: ['header', 'query'],
    token_types_supported: ['access_token']
  });

  let getClientConfig = (base: string) => ({
    issuer: getConfig().urls.apiUrl,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none'
    ],
    code_challenge_methods_supported: ['S256'],
    client_id_metadata_document_supported: false
  });

  let resolveRoute = async (c: {
    req: {
      param: (key?: string) => string | Record<string, string>;
    };
  }) => {
    let portalId = c.req.param('portalId') as string;
    let rawMagicMcpTargetId = c.req.param('magicMcpTargetId');
    let magicMcpTargetId =
      typeof rawMagicMcpTargetId == 'string' && rawMagicMcpTargetId.length > 0
        ? rawMagicMcpTargetId
        : undefined;

    return await consumerOAuthService.resolvePortalRoute({
      portalId,
      magicMcpTargetId
    });
  };

  let metadataServer = createOAuthHono();
  for (let path of [
    ':portalId/:magicMcpTargetId',
    ':portalId',
    'connect/portal/:portalId/:magicMcpTargetId',
    'connect/portal/:portalId'
  ]) {
    metadataServer = metadataServer.get(path, async c => {
      let { base } = await resolveRoute(c);
      return c.json(getClientConfig(base));
    });
  }

  let connectPortalServer = createOAuthHono();

  for (let path of [':portalId/:magicMcpTargetId', ':portalId']) {
    connectPortalServer = connectPortalServer.all(path, async c => {
      let { portal, magicMcpTarget, base } = await resolveRoute(c);
      let routeMagicMcpTargetIdOrAlias = magicMcpTarget?.target.id;

      let token = getMagicMcpTokenSecretFromRequest(c.req.raw, new URL(c.req.url));
      if (token) {
        return await handleMagicMcpRequest({
          c,
          magicMcpTargetIdOrAlias: routeMagicMcpTargetIdOrAlias,
          instanceForTokenRouting: portal.instance,
          authenticate: d.authenticate
        });
      }

      let error = 'invalid_token';
      let message =
        'Missing access token. Please provide a valid token in the "Authorization" header or as a "token" query parameter to access this portal.';

      return c.json(
        {
          error,
          error_description: message
        },
        401,
        {
          'WWW-Authenticate': `Bearer realm="OAuth", resource_metadata="${base}/.well-known/oauth-protected-resource", error="${error}", error_description="${message}"`
        }
      );
    });
  }

  for (let path of [
    ':portalId/:magicMcpTargetId/.well-known/oauth-protected-resource',
    ':portalId/.well-known/oauth-protected-resource'
  ]) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      let { base } = await resolveRoute(c);
      return c.json(getProtectedResource(base));
    });
  }

  for (let path of [
    ':portalId/:magicMcpTargetId/.well-known/openid-configuration',
    ':portalId/.well-known/openid-configuration'
  ]) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      let { base } = await resolveRoute(c);
      return c.json(getClientConfig(base));
    });
  }

  for (let path of [
    ':portalId/:magicMcpTargetId/oauth/register',
    ':portalId/oauth/register'
  ]) {
    connectPortalServer = connectPortalServer.post(path, async c => {
      let { portal, magicMcpTarget, base } = await resolveRoute(c);

      let input = await useValidatedBody(
        c,
        v.object({
          redirect_uris: v.array(v.string()),
          client_name: v.string(),
          token_endpoint_auth_method: v.optional(
            v.enumOf(['client_secret_basic', 'client_secret_post', 'none'])
          )
        })
      );

      let registration = await consumerOAuthService.registerPortalOAuthClient({
        portal,
        magicMcpTarget,
        input: {
          clientName: input.client_name,
          redirectUris: input.redirect_uris,
          tokenEndpointAuthMethod: input.token_endpoint_auth_method
        }
      });

      return c.json(buildPortalOAuthClientRegistration({ registration, base }));
    });
  }

  for (let path of [
    ':portalId/:magicMcpTargetId/oauth/authorize',
    ':portalId/oauth/authorize'
  ]) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      let { portal, magicMcpTarget } = await resolveRoute(c);
      let authorization = await consumerOAuthService.createPortalOAuthAuthorization({
        portal,
        magicMcpTarget,
        input: {
          responseType: getString(c.req.query('response_type')),
          clientId: getString(c.req.query('client_id')),
          redirectUri: getString(c.req.query('redirect_uri')),
          codeChallenge: getString(c.req.query('code_challenge')),
          codeChallengeMethod: getString(c.req.query('code_challenge_method')),
          state: getString(c.req.query('state'))
        }
      });

      return c.redirect(authorization.redirectUrl, 302);
    });
  }

  for (let path of [':portalId/:magicMcpTargetId/oauth/token', ':portalId/oauth/token']) {
    connectPortalServer = connectPortalServer.post(path, async c => {
      let { portal, magicMcpTarget } = await resolveRoute(c);

      let body = await parseOAuthBody(c);
      let credentials = getClientCredentials(c, body);
      let tokens = await consumerOAuthService.exchangePortalOAuthToken({
        portal,
        magicMcpTarget,
        input: {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          grantType: getString(body.grant_type),
          code: getString(body.code),
          redirectUri: getString(body.redirect_uri),
          codeVerifier: getString(body.code_verifier),
          refreshToken: getString(body.refresh_token)
        }
      });

      return c.json({
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: portalAccessTokenTtlSeconds,
        refresh_token: tokens.refreshToken,
        refresh_token_expires_in: portalRefreshTokenTtlSeconds
      });
    });
  }

  for (let path of [
    ':portalId/:magicMcpTargetId/oauth/register/:registrationId',
    ':portalId/oauth/register/:registrationId'
  ]) {
    connectPortalServer = connectPortalServer.get(path, async c => {
      let registrationId = c.req.param('registrationId');
      let { portal, magicMcpTarget, base } = await resolveRoute(c);
      let registration = await consumerOAuthService.getPortalOAuthRegistration({
        portal,
        magicMcpTarget,
        registrationId
      });

      if (!registration) {
        return c.json(
          {
            error: 'not_found',
            error_description: 'Registration not found'
          },
          404
        );
      }

      return c.json(buildPortalOAuthClientRegistration({ registration, base }));
    });
  }

  return {
    metadataServer,
    connectPortalServer
  };
};
