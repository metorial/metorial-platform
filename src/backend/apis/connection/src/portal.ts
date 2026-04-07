import { badRequestError, ServiceError } from '@lowerdeck/error';
import { useValidatedBody } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { db, ID } from '@metorial/db';
import { AuthInfo } from '@metorial/module-access';
import { Authenticator } from '@metorial/rest';
import { addDays } from 'date-fns';
import { getMagicMcpTokenSecretFromRequest, handleMagicMcpRequest } from './magic';
import { createOpaqueToken } from './oauth/challenge';
import {
  exchangeAuthorizationCodeToken,
  exchangeRefreshToken,
  getPortalAuthClient,
  resolvePortalRoute,
  validateClientSecret
} from './oauth/client';
import { createOAuthHono } from './oauth/hono';
import {
  getClientCredentials,
  getString,
  parseOAuthBody,
  validateRedirectUri,
  validateUrlString
} from './oauth/utils';

export let createPortalHandler = (d: {
  authenticate: Authenticator<AuthInfo>;
}): ReturnType<typeof createOAuthHono> =>
  createOAuthHono()
    .all(':portalId/:magicMcpServerId', async c => {
      let { portalId, magicMcpServerId } = c.req.param();
      let { base } = await resolvePortalRoute({
        portalId,
        magicMcpServerId
      });

      let token = getMagicMcpTokenSecretFromRequest(c.req.raw, new URL(c.req.url));
      if (token) {
        return await handleMagicMcpRequest({
          c,
          magicMcpServerIdOrAlias: magicMcpServerId,
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
    })
    .get(':portalId/:magicMcpServerId/.well-known/oauth-protected-resource', async c => {
      let { portalId, magicMcpServerId } = c.req.param();
      let { base } = await resolvePortalRoute({
        portalId,
        magicMcpServerId
      });

      return c.json({
        resource: `${base}`,
        authorization_servers: [getConfig().urls.apiUrl],
        bearer_methods_supported: ['header', 'query'],
        token_types_supported: ['access_token']
      });
    })
    .get(':portalId/:magicMcpServerId/.well-known/openid-configuration', async c => {
      let { portalId, magicMcpServerId } = c.req.param();
      let { base } = await resolvePortalRoute({
        portalId,
        magicMcpServerId
      });

      return c.json({
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
    })
    .post(':portalId/:magicMcpServerId/oauth/register', async c => {
      let { portalId, magicMcpServerId } = c.req.param();
      let { portal, magicMcpServer, base } = await resolvePortalRoute({
        portalId,
        magicMcpServerId
      });

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

      for (let redirectUri of input.redirect_uris) {
        validateUrlString(redirectUri, 'redirect_uri');
      }

      let tokenEndpointAuthMethod = input.token_endpoint_auth_method ?? 'client_secret_basic';
      let clientSecret =
        tokenEndpointAuthMethod == 'none'
          ? null
          : await ID.generateId('portalAuthClientSecret');

      let registration = await db.portalAuthClient.create({
        data: {
          id: await ID.generateId('portalAuthClient'),
          portalOid: portal.oid,
          magicMcpServerOid: magicMcpServer.oid,
          name: input.client_name,
          redirectUris: input.redirect_uris,
          clientId: await ID.generateId('portalAuthClientId'),
          clientSecret,
          tokenEndpointAuthMethod,
          expiresAt: addDays(new Date(), 30)
        }
      });

      return c.json({
        client_id: registration.clientId,
        client_secret: registration.clientSecret ?? undefined,
        redirect_uris: registration.redirectUris,
        client_name: registration.name,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: registration.tokenEndpointAuthMethod,
        registration_client_uri: `${base}/oauth/register/${registration.id}`,
        client_id_issued_at: Math.floor(registration.createdAt.getTime() / 1000),
        client_secret_expires_at:
          registration.clientSecret == null
            ? 0
            : Math.floor(registration.expiresAt.getTime() / 1000),
        client_secret_issued_at:
          registration.clientSecret == null
            ? undefined
            : Math.floor(registration.createdAt.getTime() / 1000)
      });
    })
    .get(':portalId/:magicMcpServerId/oauth/authorize', async c => {
      let { portalId, magicMcpServerId } = c.req.param();
      let { portal, magicMcpServer, portalUrl } = await resolvePortalRoute({
        portalId,
        magicMcpServerId
      });

      let responseType = getString(c.req.query('response_type'));
      let clientId = getString(c.req.query('client_id'));
      let redirectUri = getString(c.req.query('redirect_uri'));
      let codeChallenge = getString(c.req.query('code_challenge'));
      let codeChallengeMethod = getString(c.req.query('code_challenge_method'));
      let state = getString(c.req.query('state'));

      if (!responseType) {
        throw new ServiceError(
          badRequestError({
            message: 'response_type is required',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'response_type is required'
            }
          })
        );
      }

      if (responseType != 'code') {
        throw new ServiceError(
          badRequestError({
            message: 'Only response_type=code is supported',
            oauth: {
              error: 'unsupported_response_type',
              errorMessage: 'Only response_type=code is supported'
            }
          })
        );
      }

      if (!clientId) {
        throw new ServiceError(
          badRequestError({
            message: 'client_id is required',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'client_id is required'
            }
          })
        );
      }

      if (!redirectUri) {
        throw new ServiceError(
          badRequestError({
            message: 'redirect_uri is required',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'redirect_uri is required'
            }
          })
        );
      }

      if (codeChallengeMethod && !['S256', 's256', 'none'].includes(codeChallengeMethod)) {
        throw new ServiceError(
          badRequestError({
            message: 'Only S256 PKCE challenges are supported',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'Only S256 PKCE challenges are supported'
            }
          })
        );
      }

      let normalizedCodeChallengeMethod =
        codeChallengeMethod == 'S256' || codeChallengeMethod == 's256'
          ? ('s256' as const)
          : codeChallenge
            ? ('s256' as const)
            : ('none' as const);

      if (normalizedCodeChallengeMethod == 's256' && !codeChallenge) {
        throw new ServiceError(
          badRequestError({
            message: 'code_challenge is required when using PKCE',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'code_challenge is required when using PKCE'
            }
          })
        );
      }

      let client = await getPortalAuthClient({
        clientId,
        portalOid: portal.oid,
        magicMcpServerOid: magicMcpServer.oid
      });
      validateRedirectUri(redirectUri, client.redirectUris);

      let attempt = await db.portalAuthAttempt.create({
        data: {
          id: await ID.generateId('portalAuthAttempt'),
          portalAuthClientOid: client.oid,
          status: 'pending',
          redirectUri,
          state,
          authorizationCode: createOpaqueToken(),
          codeChallengeMethod: normalizedCodeChallengeMethod,
          codeChallenge,
          expiresAt: addDays(new Date(), 30)
        }
      });

      let redirectUrl = new URL(portalUrl);
      let basePath = redirectUrl.pathname.replace(/\/+$/, '');
      redirectUrl.pathname = `${basePath}/oauth/authorize/${attempt.id}`.replace(
        /\/{2,}/g,
        '/'
      );
      redirectUrl.search = '';
      redirectUrl.hash = '';

      return c.redirect(redirectUrl.toString(), 302);
    })
    .post(':portalId/:magicMcpServerId/oauth/token', async c => {
      let { portalId, magicMcpServerId } = c.req.param();
      let { portal, magicMcpServer } = await resolvePortalRoute({
        portalId,
        magicMcpServerId
      });

      let body = await parseOAuthBody(c);
      let credentials = getClientCredentials(c, body);
      let grantType = getString(body.grant_type);
      let code = getString(body.code);
      let redirectUri = getString(body.redirect_uri);
      let codeVerifier = getString(body.code_verifier);
      let refreshToken = getString(body.refresh_token);

      if (!grantType) {
        throw new ServiceError(
          badRequestError({
            message: 'grant_type is required',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'grant_type is required'
            }
          })
        );
      }

      if (!credentials.clientId) {
        throw new ServiceError(
          badRequestError({
            message: 'client_id is required',
            oauth: {
              error: 'invalid_request',
              errorMessage: 'client_id is required'
            }
          })
        );
      }

      let client = await getPortalAuthClient({
        clientId: credentials.clientId,
        portalOid: portal.oid,
        magicMcpServerOid: magicMcpServer.oid
      });
      validateClientSecret({
        client,
        clientSecret: credentials.clientSecret
      });

      let tokens: { accessToken: string; refreshToken: string };
      if (grantType == 'authorization_code') {
        if (!code) {
          throw new ServiceError(
            badRequestError({
              message: 'code is required for the authorization_code grant',
              oauth: {
                error: 'invalid_request',
                errorMessage: 'code is required for the authorization_code grant'
              }
            })
          );
        }

        if (!redirectUri) {
          throw new ServiceError(
            badRequestError({
              message: 'redirect_uri is required for the authorization_code grant',
              oauth: {
                error: 'invalid_request',
                errorMessage: 'redirect_uri is required for the authorization_code grant'
              }
            })
          );
        }

        tokens = await exchangeAuthorizationCodeToken({
          portal,
          magicMcpServer,
          client,
          code,
          redirectUri,
          codeVerifier
        });
      } else if (grantType == 'refresh_token') {
        if (!refreshToken) {
          throw new ServiceError(
            badRequestError({
              message: 'refresh_token is required for the refresh_token grant',
              oauth: {
                error: 'invalid_request',
                errorMessage: 'refresh_token is required for the refresh_token grant'
              }
            })
          );
        }

        tokens = await exchangeRefreshToken({
          portal,
          magicMcpServer,
          client,
          refreshToken
        });
      } else {
        throw new ServiceError(
          badRequestError({
            message: `Unsupported grant type: ${grantType}`,
            oauth: {
              error: 'unsupported_grant_type',
              errorMessage: `Unsupported grant type: ${grantType}`
            }
          })
        );
      }

      return c.json({
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        refresh_token: tokens.refreshToken
      });
    })
    .get(':portalId/:magicMcpServerId/oauth/register/:registrationId', async c => {
      let { portalId, magicMcpServerId, registrationId } = c.req.param();
      let { portal, magicMcpServer, base } = await resolvePortalRoute({
        portalId,
        magicMcpServerId
      });

      let registration = await db.portalAuthClient.findFirst({
        where: {
          id: registrationId,
          portalOid: portal.oid,
          magicMcpServerOid: magicMcpServer.oid
        }
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

      return c.json({
        client_id: registration.clientId,
        client_secret: registration.clientSecret ?? undefined,
        redirect_uris: registration.redirectUris,
        client_name: registration.name,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: registration.tokenEndpointAuthMethod,
        registration_client_uri: `${base}/oauth/register/${registration.id}`,
        client_id_issued_at: Math.floor(registration.createdAt.getTime() / 1000),
        client_secret_expires_at:
          registration.clientSecret == null
            ? 0
            : Math.floor(registration.expiresAt.getTime() / 1000),
        client_secret_issued_at:
          registration.clientSecret == null
            ? undefined
            : Math.floor(registration.createdAt.getTime() / 1000)
      });
    });
