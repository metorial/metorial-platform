import { Context, useRequestContext, useValidatedBody } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { AuthInfo } from '@metorial/module-access';
import {
  consumerAuthAccessTokenTtlSeconds,
  consumerAuthRefreshTokenTtlSeconds,
  consumerOAuthAuthorizationService,
  consumerOAuthRegistrationService,
  consumerOAuthRoutingService,
  consumerOAuthTestAuthorizationService,
  consumerOAuthTokenService
} from '@metorial/module-consumer';
import { Authenticator } from '@metorial/rest';
import { getMagicMcpTokenSecretFromRequest, handleMagicMcpRequest } from './magic';
import {
  buildOAuthClientConfig,
  buildOAuthProtectedResource,
  createPluginOAuthServers,
  createPortalOAuthServers
} from './oauth/skeleton';
import { getClientCredentials, getString, parseOAuthBody } from './oauth/utils';

export { createPluginOAuthServers, createPortalOAuthServers } from './oauth/skeleton';

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

let getPluginOAuthInput = (c: Context) => ({
  responseType: getString(c.req.query('response_type')),
  clientId: getString(c.req.query('client_id')),
  redirectUri: getString(c.req.query('redirect_uri')),
  codeChallenge: getString(c.req.query('code_challenge')),
  codeChallengeMethod: getString(c.req.query('code_challenge_method')),
  state: getString(c.req.query('state'))
});

let appendPluginOAuthParams = (url: URL, input: ReturnType<typeof getPluginOAuthInput>) => {
  if (input.responseType) url.searchParams.set('response_type', input.responseType);
  if (input.clientId) url.searchParams.set('client_id', input.clientId);
  if (input.redirectUri) url.searchParams.set('redirect_uri', input.redirectUri);
  if (input.codeChallenge) url.searchParams.set('code_challenge', input.codeChallenge);
  if (input.codeChallengeMethod) {
    url.searchParams.set('code_challenge_method', input.codeChallengeMethod);
  }
  if (input.state) url.searchParams.set('state', input.state);
};

let buildPluginPortalSelectorUrl = (d: {
  pluginId: string;
  input: ReturnType<typeof getPluginOAuthInput>;
}) => {
  let url = new URL(getConfig().urls.portalsUrl);
  let basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${basePath}/select-portal`.replace(/\/{2,}/g, '/');
  url.search = '';
  url.hash = '';
  url.searchParams.set('plugin_id', d.pluginId);
  appendPluginOAuthParams(url, d.input);

  return url.toString();
};

export let createPortalHandler = (d: {
  authenticate: Authenticator<AuthInfo>;
}): {
  metadataServer: ReturnType<typeof createPortalOAuthServers>['metadataServer'];
  connectPortalServer: ReturnType<typeof createPortalOAuthServers>['connectPortalServer'];
} => {
  return createPortalOAuthServers({
    resolveRoute: async ({ portalId, magicMcpTargetId }) => {
      return await consumerOAuthRoutingService.resolvePortalRoute({
        portalId,
        magicMcpTargetId
      });
    },
    resolveConnectRoute: async ({ portalId, magicMcpTargetId }) => {
      return await consumerOAuthRoutingService.resolvePortalMcpRoute({
        portalId,
        magicMcpTargetId
      });
    },

    metadata: async ({ route }, c) => {
      return c.json(buildOAuthClientConfig(route.base));
    },

    portal: async ({ route }, c) => {
      let { instance, magicMcpTarget, base } = route;

      let token = getMagicMcpTokenSecretFromRequest(c.req.raw, new URL(c.req.url));
      if (token) {
        return await handleMagicMcpRequest({
          c,
          magicMcpTarget,
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

      let registration = await consumerOAuthRegistrationService.registerConsumerAuthClient({
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
      let authorization =
        await consumerOAuthAuthorizationService.createConsumerAuthAuthorization({
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

      let testAuthId = getString(c.req.query('test_auth_id'));
      if (testAuthId) {
        let consumed = await consumerOAuthTestAuthorizationService.consumeTestAuthorization({
          testAuthorizationId: testAuthId,
          instance: route.instance,
          portalOAuthAuthorization: authorization.attempt,
          input: {
            clientId: getString(c.req.query('client_id')),
            redirectUri: getString(c.req.query('redirect_uri')),
            codeChallenge: getString(c.req.query('code_challenge')),
            codeChallengeMethod: getString(c.req.query('code_challenge_method')),
            state: getString(c.req.query('state'))
          }
        });

        return c.redirect(consumed.redirectUrl, 302);
      }

      return c.redirect(authorization.redirectUrl, 302);
    },

    token: async ({ route }, c) => {
      let { portal, consumerSurface, magicMcpTarget } = route;

      let body = await parseOAuthBody(c);
      let credentials = getClientCredentials(c, body);
      let tokens = await consumerOAuthTokenService.exchangeConsumerAuthToken({
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
      let registration = await consumerOAuthRegistrationService.getConsumerAuthRegistration({
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

export let createPluginHandler = (d: {
  authenticate: Authenticator<AuthInfo>;
}): {
  metadataServer: ReturnType<typeof createPluginOAuthServers>['metadataServer'];
  connectPluginServer: ReturnType<typeof createPluginOAuthServers>['connectPluginServer'];
} => {
  return createPluginOAuthServers({
    resolveRoute: async ({ skillPluginId }) => {
      return await consumerOAuthRoutingService.resolveSkillPluginRoute({ skillPluginId });
    },

    metadata: async ({ route }, c) => {
      return c.json(buildOAuthClientConfig(route.base));
    },

    portal: async ({ route }, c) => {
      let { instance, base } = route;

      let token = getMagicMcpTokenSecretFromRequest(c.req.raw, new URL(c.req.url));
      if (token) {
        return await handleMagicMcpRequest({
          c,
          instanceForTokenRouting: instance,
          authenticate: d.authenticate
        });
      }

      let error = 'invalid_token';
      let message =
        'Missing access token. Please provide a valid token in the "Authorization" header or as a "key" query parameter.';

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
      let { skillPlugin, base } = route;
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

      let registration =
        await consumerOAuthRegistrationService.registerSkillPluginConsumerAuthClient({
          skillPlugin,
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
      let { skillPlugin } = route;
      let portalId = getString(c.req.query('portal_id'));
      let input = getPluginOAuthInput(c);
      let authorization =
        await consumerOAuthAuthorizationService.createSkillPluginConsumerAuthAuthorization({
          skillPlugin,
          portalId,
          input
        });

      if (authorization.type != 'redirect') {
        return c.redirect(
          buildPluginPortalSelectorUrl({
            pluginId: skillPlugin.id,
            input
          }),
          302
        );
      }

      let testAuthId = getString(c.req.query('test_auth_id'));
      if (testAuthId) {
        let consumed = await consumerOAuthTestAuthorizationService.consumeTestAuthorization({
          testAuthorizationId: testAuthId,
          instance: route.instance,
          portalOAuthAuthorization: authorization.authorization.attempt,
          input: getPluginOAuthInput(c)
        });

        return c.redirect(consumed.redirectUrl, 302);
      }

      return c.redirect(authorization.redirectUrl, 302);
    },

    portalSelected: async ({ route }, c) => {
      let { skillPlugin } = route;
      let portalId = getString(c.req.query('portal_id'));
      let authorization =
        await consumerOAuthAuthorizationService.createSkillPluginConsumerAuthAuthorization({
          skillPlugin,
          portalId,
          input: getPluginOAuthInput(c)
        });

      if (authorization.type != 'redirect') {
        return c.redirect(
          buildPluginPortalSelectorUrl({
            pluginId: skillPlugin.id,
            input: getPluginOAuthInput(c)
          }),
          302
        );
      }

      return c.redirect(authorization.redirectUrl, 302);
    },

    token: async ({ route }, c) => {
      let { skillPlugin } = route;

      let body = await parseOAuthBody(c);
      let credentials = getClientCredentials(c, body);
      let tokens = await consumerOAuthTokenService.exchangeSkillPluginConsumerAuthToken({
        skillPlugin,
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
      let { skillPlugin, base } = route;
      let registration =
        await consumerOAuthRegistrationService.getSkillPluginConsumerAuthRegistration({
          skillPlugin,
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
