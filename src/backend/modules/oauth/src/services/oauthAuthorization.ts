import { db, ID, ProviderOAuthConnection } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Service } from '@metorial/service';
import { differenceInMinutes, subMinutes } from 'date-fns';
import { oauthErrorDescriptions } from '../lib/oauthErrors';
import { OAuthUtils } from '../lib/oauthUtils';
import { OAuthConfiguration, TokenResponse, UserProfile } from '../types';

class OauthAuthorizationServiceImpl {
  async startAuthorization(d: {
    connection: ProviderOAuthConnection;
    redirectUri: string;
    getCallbackUrl: (d: { connection: ProviderOAuthConnection }) => string;
  }) {
    if (d.connection.status != 'active') {
      throw new ServiceError(badRequestError({ message: 'Connection has been deactivated' }));
    }

    let config = d.connection.config as OAuthConfiguration;
    let supportsPKCE = !!config.code_challenge_methods_supported?.includes('S256');

    let callbackUrl = d.getCallbackUrl({ connection: d.connection });

    let authAttempt = await db.providerOAuthConnectionAuthAttempt.create({
      data: {
        id: await ID.generateId('oauthConnectionAuthAttempt'),

        stateIdentifier: await ID.generateId('oauthConnectionAuthAttempt_State'),

        status: 'pending',
        redirectUri: d.redirectUri,

        connectionOid: d.connection.oid,

        codeVerifier: supportsPKCE ? OAuthUtils.generateCodeVerifier() : undefined
      }
    });

    let codeChallenge = authAttempt.codeVerifier
      ? await OAuthUtils.generateCodeChallenge(authAttempt.codeVerifier)
      : undefined;

    return OAuthUtils.buildAuthorizationUrl({
      authEndpoint: config.authorization_endpoint,
      clientId: d.connection.clientId,
      redirectUri: callbackUrl,
      scopes: d.connection.scopes,
      state: authAttempt.stateIdentifier!,
      codeChallenge
    });
  }

  async completeAuthorization(d: {
    connection: ProviderOAuthConnection;
    response: {
      code?: string;
      state?: string;
      error?: string;
      errorDescription?: string;
    };
    getCallbackUrl: (d: { connection: ProviderOAuthConnection }) => string;
  }) {
    if (d.response.error) {
      await db.providerOAuthConnectionAuthAttempt.update({
        where: {
          connectionOid: d.connection.oid,
          stateIdentifier: d.response.state!,
          status: 'pending'
        },
        data: {
          status: 'failed',
          stateIdentifier: null,
          clientSecret: null,

          errorCode: d.response.error,
          errorMessage:
            d.response.errorDescription ??
            oauthErrorDescriptions[d.response.error] ??
            d.response.error
        }
      });

      throw new ServiceError(
        badRequestError({
          message: 'Authorization failed',
          description: `The provider "${d.connection.providerName}" returned an error: ${d.response.error} - ${d.response.errorDescription}`
        })
      );
    }

    let callbackUrl = d.getCallbackUrl({ connection: d.connection });

    let attempt = await db.providerOAuthConnectionAuthAttempt.findFirst({
      where: {
        stateIdentifier: d.response.state!,
        connectionOid: d.connection.oid,
        status: 'pending',
        createdAt: {
          gte: subMinutes(new Date(), 60 * 2)
        }
      }
    });
    if (!attempt) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid authorization attempt',
          description:
            'The provided state identifier does not match any pending attempts. Maybe the attempt has already been completed or expired.'
        })
      );
    }

    let tokenResponse: TokenResponse;

    try {
      tokenResponse = await OAuthUtils.exchangeCodeForTokens({
        tokenEndpoint: d.connection.config.token_endpoint,
        clientId: d.connection.clientId,
        clientSecret: d.connection.clientSecret,
        code: d.response.code!,
        redirectUri: callbackUrl,
        codeVerifier: attempt.codeVerifier ?? undefined
      });
    } catch (error) {
      await db.providerOAuthConnectionAuthAttempt.update({
        where: {
          connectionOid: d.connection.oid,
          stateIdentifier: d.response.state!,
          status: 'pending'
        },
        data: {
          status: 'failed',
          stateIdentifier: null,
          clientSecret: null,

          errorCode: 'token_exchange_failed',
          errorMessage: `Failed to exchange authorization code for tokens`
        }
      });

      throw error;
    }

    let providerProfile: UserProfile | null = null;
    if (d.connection.config.userinfo_endpoint) {
      try {
        providerProfile = await OAuthUtils.getUserProfile({
          userInfoEndpoint: d.connection.config.userinfo_endpoint,
          accessToken: tokenResponse.access_token
        });
      } catch (error) {
        // Ignore
      }
    }

    let profile = providerProfile
      ? await db.providerOAuthConnectionProfile.upsert({
          where: {
            connectionOid_sub: {
              connectionOid: d.connection.oid,
              sub: providerProfile.sub
            }
          },
          update: {
            name: providerProfile.name,
            email: providerProfile.email,
            rawProfile: providerProfile.raw,
            lastUsedAt: new Date()
          },
          create: {
            id: await ID.generateId('oauthConnectionProfile'),

            connectionOid: d.connection.oid,

            sub: providerProfile.sub,
            name: providerProfile.name,
            email: providerProfile.email,
            rawProfile: providerProfile.raw
          }
        })
      : null;

    let expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    let token = await db.providerOAuthConnectionAuthToken.create({
      data: {
        id: await ID.generateId('oauthConnectionAuthToken'),

        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
        expiresAt: expiresAt,
        refreshToken: tokenResponse.refresh_token || null,
        idToken: tokenResponse.id_token || null,
        scope: tokenResponse.scope || null,

        connectionOid: d.connection.oid,
        connectionProfileOid: profile?.oid
      }
    });

    attempt = await db.providerOAuthConnectionAuthAttempt.update({
      where: {
        connectionOid: d.connection.oid,
        stateIdentifier: d.response.state!,
        status: 'pending'
      },
      data: {
        status: 'completed',
        clientSecret: await ID.generateId('oauthConnectionAuthAttempt_ClientSecret'),
        stateIdentifier: null,
        authTokenOid: token.oid
      }
    });

    let url = new URL(attempt.redirectUri);
    url.searchParams.set('metorial_token_type', 'oauth');
    url.searchParams.set('metorial_auth_attempt_id', attempt.id);
    url.searchParams.set('metorial_token', attempt.clientSecret!);

    return {
      url: url.toString(),
      authAttempt: attempt
    };
  }

  async exchangeAuthAttempt(d: { clientSecret: string }) {
    let authAttempt = await db.providerOAuthConnectionAuthAttempt.findFirst({
      where: {
        clientSecret: d.clientSecret,
        status: 'completed',
        authTokenOid: { not: null },
        createdAt: {
          gte: subMinutes(new Date(), 5)
        }
      },
      include: {
        authToken: true
      }
    });
    if (!authAttempt || !authAttempt.authToken) {
      throw new ServiceError(badRequestError({ message: 'Invalid authorization attempt' }));
    }

    await db.providerOAuthConnectionAuthAttempt.update({
      where: { id: authAttempt.id, clientSecret: authAttempt.clientSecret! },
      data: { stateIdentifier: null, clientSecret: null }
    });

    return await db.providerOAuthConnectionAuthTokenReference.create({
      data: {
        authTokenOid: authAttempt.authToken.oid
      }
    });
  }

  async useAuthToken(d: { referenceOid: bigint }) {
    let ref = await db.providerOAuthConnectionAuthTokenReference.findUnique({
      where: { oid: d.referenceOid },
      include: { authToken: { include: { connection: true } } }
    });
    if (!ref || !ref.authToken) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider authentication token has expired. Please reauthenticate.'
        })
      );
    }

    let token = ref.authToken;

    if (!token.expiresAt || token.expiresAt > new Date()) {
      if (Math.abs(differenceInMinutes(token.lastUsedAt, new Date())) > 5) {
        await db.providerOAuthConnectionAuthToken.update({
          where: { oid: token.oid },
          data: { lastUsedAt: new Date() }
        });
      }

      return token;
    }

    if (!token.refreshToken) {
      throw new ServiceError(
        badRequestError({
          message:
            'Provider authentication token has expired and cannot be refreshed. Please reauthenticate.'
        })
      );
    }

    let connection = token.connection;

    let tokenResponse = await OAuthUtils.refreshAccessToken({
      tokenEndpoint: connection.config.token_endpoint,
      clientId: connection.clientId,
      clientSecret: connection.clientSecret,
      refreshToken: token.refreshToken
    });

    return await db.providerOAuthConnectionAuthToken.update({
      where: { oid: token.oid },
      data: {
        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
        expiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null,
        refreshToken: tokenResponse.refresh_token || null,
        idToken: tokenResponse.id_token || null,
        scope: tokenResponse.scope || null,
        lastUsedAt: new Date()
      }
    });
  }
}

export let oauthAuthorizationService = Service.create(
  'oauthAuthorization',
  () => new OauthAuthorizationServiceImpl()
).build();
