import { useRequestContext, useValidatedBody } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { AuthInfo } from '@metorial/module-access';
import {
  consumerOAuthService,
  consumerAuthAccessTokenTtlSeconds,
  consumerAuthRefreshTokenTtlSeconds
} from '@metorial/module-portal';
import { Authenticator } from '@metorial/rest';
import { getMagicMcpTokenSecretFromRequest, handleMagicMcpRequest } from './magic';
import {
  buildOAuthClientConfig,
  buildOAuthProtectedResource,
  createPortalOAuthServers
} from './oauth/skeleton';
import { getClientCredentials, getString, parseOAuthBody } from './oauth/utils';

export { createPortalOAuthServers } from './oauth/skeleton';

let buildOAuthClientRegistration = (d: {
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

export let createPortalHandler = (d: {
  authenticate: Authenticator<AuthInfo>;
}): {
  metadataServer: ReturnType<typeof createPortalOAuthServers>['metadataServer'];
  connectPortalServer: ReturnType<typeof createPortalOAuthServers>['connectPortalServer'];
} => {

  return createPortalOAuthServers({
    resolveRoute: async ({ portalId, magicMcpTargetId }) => {
      return await consumerOAuthService.resolvePortalRoute({
        portalId,
        magicMcpTargetId
      });
    },

    metadata: async ({ route }, c) => {
      return c.json(buildOAuthClientConfig(route.base));
    },

    portal: async ({ route }, c) => {
      let { instance, magicMcpTarget, base } = route;
      let routeMagicMcpTargetIdOrAlias = magicMcpTarget?.target.id;

      let token = getMagicMcpTokenSecretFromRequest(c.req.raw, new URL(c.req.url));
      if (token) {
        return await handleMagicMcpRequest({
          c,
          magicMcpTargetIdOrAlias: routeMagicMcpTargetIdOrAlias,
          instanceForTokenRouting: instance,
          authenticate: d.authenticate
        });
      }

      let error = 'invalid_token';
      let message =
        'Missing access token. Please provide a valid token in the "Authorization" header or as a "token" query parameter.';

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
    },

    protectedResource: async ({ route }, c) => {
      return c.json(buildOAuthProtectedResource(route.base));
    },

    openIdConfiguration: async ({ route }, c) => {
      return c.json(buildOAuthClientConfig(route.base));
    },

    register: async ({ route }, c) => {
      let { portal, consumerSurface, magicMcpTarget, base } = route;
      let { ip } = useRequestContext(c);

      if (!ip) {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Unable to determine the request IP address'
          },
          400
        );
      }

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

      let registration = await consumerOAuthService.registerConsumerAuthClient({
        portal: portal ?? undefined,
        consumerSurface: consumerSurface ?? undefined,
        magicMcpTarget,
        input: {
          clientName: input.client_name,
          redirectUris: input.redirect_uris,
          registrationIp: ip,
          tokenEndpointAuthMethod: input.token_endpoint_auth_method
        }
      });

      return c.json(buildOAuthClientRegistration({ registration, base }));
    },

    authorize: async ({ route }, c) => {
      let { portal, consumerSurface, magicMcpTarget } = route;
      let authorization = await consumerOAuthService.createConsumerAuthAuthorization({
        portal: portal ?? undefined,
        consumerSurface: consumerSurface ?? undefined,
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
    },

    token: async ({ route }, c) => {
      let { portal, consumerSurface, magicMcpTarget } = route;

      let body = await parseOAuthBody(c);
      let credentials = getClientCredentials(c, body);
      let tokens = await consumerOAuthService.exchangeConsumerAuthToken({
        portal: portal ?? undefined,
        consumerSurface: consumerSurface ?? undefined,
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
        expires_in: consumerAuthAccessTokenTtlSeconds,
        refresh_token: tokens.refreshToken,
        refresh_token_expires_in: consumerAuthRefreshTokenTtlSeconds
      });
    },

    registration: async ({ route, registrationId }, c) => {
      let { portal, consumerSurface, magicMcpTarget, base } = route;
      let registration = await consumerOAuthService.getConsumerAuthRegistration({
        portal: portal ?? undefined,
        consumerSurface: consumerSurface ?? undefined,
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

      return c.json(buildOAuthClientRegistration({ registration, base }));
    }
  });
};

