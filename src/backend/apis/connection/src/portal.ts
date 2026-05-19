import { useRequestContext, useValidatedBody } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { AuthInfo } from '@metorial/module-access';
import {
  consumerAuthAccessTokenTtlSeconds,
  consumerAuthRefreshTokenTtlSeconds,
  consumerOAuthAuthorizationService,
  consumerOAuthRegistrationService,
  consumerOAuthRoutingService,
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

let escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

let renderSkillPluginPortalMessage = (d: { title: string; body: string }) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(d.title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #fafafa; color: #111827; }
      main { max-width: 560px; margin: 80px auto; background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; }
      h1 { font-size: 24px; margin: 0 0 12px; }
      p { line-height: 1.5; margin: 0; color: #4b5563; }
    </style>
  </head>
  <body><main><h1>${escapeHtml(d.title)}</h1><p>${escapeHtml(d.body)}</p></main></body>
</html>`;

let renderSkillPluginPortalChooser = (d: {
  base: string;
  skillPlugin: { id: string; name: string | null };
  portals: { id: string; name: string }[];
  input: {
    responseType?: string;
    clientId?: string;
    redirectUri?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    state?: string;
  };
}) => {
  let current = new URL(`${d.base}/oauth/authorize`);
  let title = 'Choose a Workforce portal';
  let items = d.portals
    .map(portal => {
      let href = new URL(current.toString());
      if (d.input.responseType) href.searchParams.set('response_type', d.input.responseType);
      if (d.input.clientId) href.searchParams.set('client_id', d.input.clientId);
      if (d.input.redirectUri) href.searchParams.set('redirect_uri', d.input.redirectUri);
      if (d.input.codeChallenge)
        href.searchParams.set('code_challenge', d.input.codeChallenge);
      if (d.input.codeChallengeMethod) {
        href.searchParams.set('code_challenge_method', d.input.codeChallengeMethod);
      }
      if (d.input.state) href.searchParams.set('state', d.input.state);
      href.searchParams.set('portal_id', portal.id);

      return `<li><a href="${href.toString()}">${escapeHtml(portal.name)}</a></li>`;
    })
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #fafafa; color: #111827; }
      main { max-width: 560px; margin: 80px auto; background: white; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; }
      h1 { font-size: 24px; margin: 0 0 12px; }
      p { line-height: 1.5; color: #4b5563; }
      ul { padding: 0; margin: 20px 0 0; list-style: none; display: grid; gap: 10px; }
      a { display: block; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 10px; text-decoration: none; color: #111827; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>Select which Metorial Workforce portal you want to use for ${escapeHtml(d.skillPlugin.name ?? 'this Metorial Skill')}.</p>
      <ul>${items}</ul>
    </main>
  </body>
</html>`;
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
      let authorization =
        await consumerOAuthAuthorizationService.createSkillPluginConsumerAuthAuthorization({
          skillPlugin,
          portalId,
          input: {
            responseType: getString(c.req.query('response_type')),
            clientId: getString(c.req.query('client_id')),
            redirectUri: getString(c.req.query('redirect_uri')),
            codeChallenge: getString(c.req.query('code_challenge')),
            codeChallengeMethod: getString(c.req.query('code_challenge_method')),
            state: getString(c.req.query('state'))
          }
        });

      if (authorization.type == 'workforce_required') {
        return c.html(
          renderSkillPluginPortalMessage({
            title: 'Metorial Workforce is required',
            body: 'Metorial Skills can only be used with Metorial Workforce. Create a Workforce portal for this instance, then try connecting this skill again.'
          })
        );
      }

      if (authorization.type == 'portal_selection') {
        return c.html(
          renderSkillPluginPortalChooser({
            base: route.base,
            skillPlugin: authorization.skillPlugin,
            portals: authorization.portals,
            input: {
              responseType: getString(c.req.query('response_type')),
              clientId: getString(c.req.query('client_id')),
              redirectUri: getString(c.req.query('redirect_uri')),
              codeChallenge: getString(c.req.query('code_challenge')),
              codeChallengeMethod: getString(c.req.query('code_challenge_method')),
              state: getString(c.req.query('state'))
            }
          })
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
