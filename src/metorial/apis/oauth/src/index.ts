import { getConfig } from '@metorial/config';
import {
  machineAccessAuthService,
  type OAuthAuthorizationRequestWithRelations,
  oauthAuthorizationService,
  oauthOidcService
} from '@metorial/module-machine-access';
import { ensureOptionalClientSecretIsValid } from './impl/credentials';
import { OAuthError } from './lib/errors';
import { getExpiresIn } from './lib/expiration';
import { getString } from './lib/request';
import { createOAuthAppSkeleton } from './skeleton';

export let oauthApi = createOAuthAppSkeleton({
  oauth: {
    token: async (
      {
        context,
        credentials,
        grantType,
        code,
        redirectUri,
        codeVerifier,
        deviceCode,
        refreshToken,
        expiresIn,
        scope
      },
      c
    ) => {
      await ensureOptionalClientSecretIsValid({
        clientId: credentials.clientId!,
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
            clientId: credentials.clientId!,
            code,
            redirectUri,
            clientSecret: credentials.clientSecret,
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
            clientId: credentials.clientId!,
            clientSecret: credentials.clientSecret,
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
            clientId: credentials.clientId!,
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
            clientId: credentials.clientId!,
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

      let idToken: string | null = null;
      if ('oauthAuthorizationRequest' in response) {
        let oauthAuthorizationRequest =
          response.oauthAuthorizationRequest as OAuthAuthorizationRequestWithRelations | null;
        if (
          oauthAuthorizationRequest &&
          response.oauthAuthorization.oidcScopes.includes('openid')
        ) {
          idToken = await oauthOidcService.createIdToken({
            oauthToken: response.oauthToken,
            oauthAuthorizationRequest
          });
        }
      }

      return c.json({
        access_token: response.oauthToken.accessToken,
        token_type: 'Bearer',
        expires_in: getExpiresIn(response.oauthToken.accessTokenExpiresAt),
        refresh_token: response.oauthToken.refreshToken ?? undefined,
        id_token: idToken ?? undefined,
        scope: oauthOidcService.getGrantedScopes(response.oauthAuthorization).join(' '),

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
    },

    deviceAuthorization: async ({ context, credentials, scopes }, c) => {
      await ensureOptionalClientSecretIsValid({
        clientId: credentials.clientId!,
        clientSecret: credentials.clientSecret
      });

      let oauthAuthorizationRequest =
        await oauthAuthorizationService.createOAuthAuthorizationRequest({
          context,
          input: {
            type: 'device_code',
            clientId: credentials.clientId!,
            clientIp: context.ip,
            scopes
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
        scope:
          [
            ...new Set([
              ...oauthAuthorizationRequest.scopes,
              ...oauthAuthorizationRequest.oidcScopes
            ])
          ].join(' ') || undefined
      });
    },

    authorize: async (d, c) => {
      if (d.type == 'token') {
        let authUrl = new URL(`/oauth/authorize`, getConfig().urls.appUrl);
        authUrl.searchParams.set('token', d.token);
        return c.redirect(authUrl, 302);
      }

      let oauthAuthorizationRequest =
        await oauthAuthorizationService.createOAuthAuthorizationRequest({
          context: d.context,
          input: {
            type: 'interactive',
            clientId: d.clientId,
            redirectUri: d.redirectUri,
            scopes: d.scopes ?? [],
            state: getString(d.state),
            nonce: getString(d.nonce),
            codeChallengeMethod: d.codeChallengeMethod,
            codeChallenge: d.codeChallenge
          }
        });

      let verificationUrl = new URL(`/oauth/authorize`, getConfig().urls.appUrl);
      verificationUrl.searchParams.set('token', oauthAuthorizationRequest.urlToken);

      return c.redirect(verificationUrl, 302);
    },

    openIdConfiguration: async ({}, c) => {
      return c.json(await oauthOidcService.getOpenIdConfiguration());
    },

    oauthProtectedResourceMetadata: async ({}, c) => {
      return c.json(await oauthOidcService.getOAuthProtectedResourceMetadata());
    },

    oauthAuthorizationServerMetadata: async ({}, c) => {
      return c.json(await oauthOidcService.getOAuthAuthorizationServerMetadata());
    },

    jwks: async ({}, c) => {
      return c.json(await oauthOidcService.getPublicJwks());
    },

    userinfo: async ({ context, accessToken }, c) => {
      let auth = await machineAccessAuthService.authenticateWithMachineAccessToken({
        token: accessToken,
        context
      });

      if (auth.type != 'oauth_token') {
        throw new OAuthError({
          error: 'invalid_token',
          status: 401,
          errorMessage: 'Invalid OAuth access token'
        });
      }

      return c.json(oauthOidcService.buildUserInfoClaims(auth.oauthToken.oauthAuthorization));
    }
  },

  cli: {
    authStart: async ({ context }, c) => {
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
    },

    authComplete: async ({ token }, c) => {
      let response = await oauthAuthorizationService.exchangeCliAuthToken({
        token
      });

      return c.json({
        access_token: response.oauthToken.accessToken,
        expires_in: getExpiresIn(response.oauthToken.accessTokenExpiresAt),
        refresh_token: response.oauthToken.refreshToken ?? undefined,
        scope: oauthOidcService.getGrantedScopes(response.oauthAuthorization),
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
    }
  }
});
