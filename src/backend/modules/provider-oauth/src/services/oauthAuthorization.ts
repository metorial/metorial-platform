import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthToken
} from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { getSentry } from '@metorial/sentry';
import { Service } from '@metorial/service';
import { differenceInDays, differenceInMinutes, subMinutes } from 'date-fns';
import { callbackUrl } from '../const';
import { oauthErrorDescriptions } from '../lib/oauthErrors';
import { OAuthUtils } from '../lib/oauthUtils';
import { addErrorCheck } from '../queue/errorCheck';
import { OAuthConfiguration, TokenResponse, UserProfile } from '../types';

let Sentry = getSentry();

class OauthAuthorizationServiceImpl {
  async startAuthorization(d: {
    context: Context;
    connection: ProviderOAuthConnection;
    redirectUri: string;
  }) {
    if (d.connection.status != 'active') {
      throw new ServiceError(badRequestError({ message: 'Connection has been deactivated' }));
    }

    let config = d.connection.config as OAuthConfiguration;
    let supportsPKCE = !!config.code_challenge_methods_supported?.includes('S256');

    await Fabric.fire('provider_oauth.connection.authentication.started:before', {
      context: d.context,
      providerOauthConnection: d.connection
    });

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

    await Fabric.fire('provider_oauth.connection.authentication.started:after', {
      context: d.context,
      providerOauthConnection: d.connection,
      authAttempt
    });

    return {
      authAttempt,
      redirectUrl: OAuthUtils.buildAuthorizationUrl({
        authEndpoint: config.authorization_endpoint,
        clientId: d.connection.clientId,
        redirectUri: callbackUrl,
        scopes: d.connection.scopes,
        state: authAttempt.stateIdentifier!,
        codeChallenge
      })
    };
  }

  async completeAuthorization(d: {
    context: Context;

    response: {
      code?: string;
      state?: string;
      error?: string;
      errorDescription?: string;
    };
  }) {
    if (d.response.error) {
      if (d.response.state) {
        let res = await db.providerOAuthConnectionAuthAttempt.updateMany({
          where: {
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

        if (res.count === 0) {
          throw new ServiceError(
            badRequestError({
              message: 'Invalid authorization attempt',
              description: 'The provided state identifier does not match any pending attempts.'
            })
          );
        }
      }

      throw new ServiceError(
        badRequestError({
          message: 'Authorization failed',
          description: `The provider returned an error: ${d.response.error} - ${d.response.errorDescription}`
        })
      );
    }

    if (!d.response.code || !d.response.state) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid authorization response',
          description: 'The response must contain a code and state parameter.'
        })
      );
    }

    let attempt = await db.providerOAuthConnectionAuthAttempt.findFirst({
      where: {
        stateIdentifier: d.response.state!,
        status: 'pending',
        createdAt: {
          gte: subMinutes(new Date(), 60 * 2)
        }
      },
      include: { connection: true }
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
    let connection = attempt.connection;

    await Fabric.fire('provider_oauth.connection.authentication.completed:before', {
      context: d.context,
      providerOauthConnection: connection,
      authAttempt: attempt
    });

    let tokenResponse: TokenResponse;

    try {
      tokenResponse = await OAuthUtils.exchangeCodeForTokens({
        tokenEndpoint: connection.config.token_endpoint,
        clientId: connection.clientId,
        clientSecret: connection.clientSecret ?? undefined,
        code: d.response.code!,
        redirectUri: callbackUrl,
        codeVerifier: attempt.codeVerifier ?? undefined,
        config: connection.config
      });
    } catch (error) {
      await db.providerOAuthConnectionAuthAttempt.update({
        where: {
          connectionOid: connection.oid,
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
    if (connection.config.userinfo_endpoint) {
      try {
        providerProfile = await OAuthUtils.getUserProfile({
          userInfoEndpoint: connection.config.userinfo_endpoint,
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
              connectionOid: connection.oid,
              sub: providerProfile.sub
            }
          },
          update: {
            name: providerProfile.name,
            email: providerProfile.email,
            rawProfile: {}, // providerProfile.raw,
            lastUsedAt: new Date()
          },
          create: {
            id: await ID.generateId('oauthConnectionProfile'),

            connectionOid: connection.oid,

            sub: providerProfile.sub,
            name: providerProfile.name,
            email: providerProfile.email,
            rawProfile: {} // providerProfile.raw
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

        connectionOid: connection.oid,
        connectionProfileOid: profile?.oid
      }
    });

    let updatedAuthAttempt = await db.providerOAuthConnectionAuthAttempt.update({
      where: {
        connectionOid: connection.oid,
        stateIdentifier: d.response.state!,
        status: 'pending'
      },
      data: {
        status: 'completed',
        clientSecret: await ID.generateId('oauthConnectionAuthAttempt_ClientSecret'),
        stateIdentifier: null,
        authTokenOid: token.oid,
        profileOid: profile?.oid
      }
    });

    await Fabric.fire('provider_oauth.connection.authentication.completed:after', {
      context: d.context,
      providerOauthConnection: connection,
      authAttempt: updatedAuthAttempt
    });

    let url = new URL(updatedAuthAttempt.redirectUri);
    url.searchParams.set('metorial_token_type', 'oauth');
    url.searchParams.set('metorial_auth_attempt_id', updatedAuthAttempt.id);
    url.searchParams.set('metorial_token', updatedAuthAttempt.clientSecret!);

    return {
      redirectUrl: url.toString(),
      authAttempt: updatedAuthAttempt
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

  async useAuthToken(d: { referenceOid: bigint; instance: Instance }) {
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

    let connection = ref.authToken.connection;
    let token: ProviderOAuthConnectionAuthToken = ref.authToken;

    if (Math.abs(differenceInMinutes(token.lastUsedAt, new Date())) > 5) {
      await db.providerOAuthConnectionAuthToken.updateMany({
        where: { oid: token.oid },
        data: { lastUsedAt: new Date() }
      });
    }

    if (token.expiresAt && token.expiresAt <= new Date()) {
      token = await (async () => {
        if (!token.refreshToken) {
          // Maybe we have another token for the same profile
          if (token.connectionProfileOid) {
            let otherToken = await db.providerOAuthConnectionAuthToken.findFirst({
              where: {
                connectionProfileOid: token.connectionProfileOid,
                connectionOid: token.connectionOid,

                OR: [
                  { expiresAt: { gt: new Date() } },
                  { expiresAt: null },
                  { refreshToken: { not: null } }
                ]
              }
            });

            if (otherToken) {
              if (Math.abs(differenceInMinutes(otherToken.lastUsedAt, new Date())) > 5) {
                await db.providerOAuthConnectionAuthToken.updateMany({
                  where: { oid: otherToken.oid },
                  data: { lastUsedAt: new Date() }
                });
              }

              // Update the reference to the other token
              await db.providerOAuthConnectionAuthTokenReference.update({
                where: { oid: d.referenceOid },
                data: { authTokenOid: otherToken.oid }
              });

              // We can just continue with the other token
              if (!otherToken.expiresAt || otherToken.expiresAt > new Date()) {
                return otherToken;
              }

              // We still need to refresh the token, so let's continue
              // but with the other token
              token = otherToken;
            }
          }

          throw new ServiceError(
            badRequestError({
              message:
                'Provider authentication token has expired and cannot be refreshed. Please reauthenticate.'
            })
          );
        }

        let res = await OAuthUtils.refreshAccessToken({
          tokenEndpoint: connection.config.token_endpoint,
          clientId: connection.clientId,
          clientSecret: connection.clientSecret ?? undefined,
          refreshToken: token.refreshToken,
          config: connection.config
        });

        if (!res.ok) {
          (async () => {
            let update = await db.providerOAuthConnectionAuthToken.update({
              where: { oid: token.oid },
              data: {
                firstErrorAt: token.firstErrorAt ?? new Date(),
                lastErrorAt: new Date(),
                errorCount: { increment: 1 },
                errorDisabledAt:
                  (token.errorDisabledAt ??
                  (token.firstErrorAt &&
                    Math.abs(differenceInDays(token.firstErrorAt, new Date())) > 1 &&
                    token.errorCount > 5))
                    ? new Date()
                    : null
              }
            });

            await addErrorCheck(connection.id);

            if (update.errorDisabledAt && !token.errorDisabledAt) {
              await db.providerOAuthConnectionAuthAttempt.updateMany({
                where: { authTokenOid: token.oid },
                data: { associatedTokenErrorDisabledAt: update.errorDisabledAt }
              });
            }
          })().catch(e => Sentry.captureException(e));

          throw new ServiceError(
            badRequestError({
              message: `Failed to refresh access token`
            })
          );
        }

        let tokenResponse = res.response;

        return await db.providerOAuthConnectionAuthToken.update({
          where: { oid: token.oid },
          data: {
            accessToken: tokenResponse.access_token,
            tokenType: tokenResponse.token_type,
            expiresAt: tokenResponse.expires_in
              ? new Date(Date.now() + tokenResponse.expires_in * 1000)
              : null,
            refreshToken: tokenResponse.refresh_token || undefined,
            idToken: tokenResponse.id_token || undefined,
            scope: tokenResponse.scope || undefined,
            lastUsedAt: new Date()
          }
        });
      })();
    }

    if (token.errorCount) {
      (async () => {
        await db.providerOAuthConnectionAuthToken.updateMany({
          where: { oid: token.oid },
          data: {
            firstErrorAt: null,
            lastErrorAt: null,
            errorCount: 0,
            errorDisabledAt: null
          }
        });

        await db.providerOAuthConnectionAuthAttempt.updateMany({
          where: { authTokenOid: token.oid },
          data: { associatedTokenErrorDisabledAt: null }
        });
      })().catch(e => Sentry.captureException(e));
    }

    (async () =>
      usageService.ingestUsageRecord({
        owner: {
          id: d.instance.id,
          type: 'instance'
        },
        entity: {
          id: connection.id,
          type: 'provider_oauth_connection'
        },
        type: 'provider_oauth_connection.created'
      }))().catch(e => Sentry.captureException(e));

    return {
      id: token.id,
      accessToken: token.accessToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      idToken: token.idToken,
      scope: token.scope,
      connection
    };
  }
}

export let providerOauthAuthorizationService = Service.create(
  'providerOauthAuthorization',
  () => new OauthAuthorizationServiceImpl()
).build();
