import { delay } from '@lowerdeck/delay';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { subMinutes } from 'date-fns';
import type {
  RemoteOAuthConfig,
  RemoteOAuthConnection,
  RemoteOAuthConnectionSetup,
  ServerOAuthSetup,
  Tenant,
  RemoteOAuthConnectionProfile
} from '../../../../prisma/generated/client';
import { oauthCallbackUrl } from '../../../config';
import { db } from '../../../db';
import { getId } from '../../../id';
import { oauthErrorDescriptions } from '../../../lib/oauth/oauthErrors';
import { OAuthUtils } from '../../../lib/oauth/oauthUtils';
import type { OAuthConfiguration, TokenResponse, UserProfile } from '../../../lib/oauth/types';
import { secretService } from '../../secret';
import { serverEventService } from '../serverEvent';
import { remoteOAuthConnectionService } from './connection';

export let getRemoteOAuthRedirectUri = (d: {
  connection: Pick<RemoteOAuthConnection, 'registrationOid'>;
  serverOAuthSetup?: { callbackUrlOverride?: string | null } | null;
}) => {
  // Auto registrations are created against Shuttle's default callback URL.
  if (d.serverOAuthSetup?.callbackUrlOverride && !d.connection.registrationOid) {
    return d.serverOAuthSetup.callbackUrlOverride;
  }

  return oauthCallbackUrl;
};

class remoteOauthAuthorizationServiceImpl {
  private async buildAuthorizationRedirect(d: {
    connection: RemoteOAuthConnection & {
      config: RemoteOAuthConfig;
    };
    setup: Pick<RemoteOAuthConnectionSetup, 'stateIdentifier' | 'codeVerifier'> & {
      tenant: Tenant;
    };
    serverOAuthSetup?: { callbackUrlOverride?: string | null } | null;
  }) {
    if (!d.setup.stateIdentifier) {
      throw new ServiceError(
        badRequestError({ message: 'OAuth authorization attempt is no longer active' })
      );
    }

    let config = d.connection.config.config as OAuthConfiguration;
    let codeChallenge = d.setup.codeVerifier
      ? await OAuthUtils.generateCodeChallenge(d.setup.codeVerifier)
      : undefined;

    let DANGEROUS_unencryptedCredentials =
      await remoteOAuthConnectionService.DANGEROUSLY_getCredentials({
        tenant: d.setup.tenant,
        connection: d.connection
      });
    let redirectUri = getRemoteOAuthRedirectUri({
      connection: d.connection,
      serverOAuthSetup: d.serverOAuthSetup
    });

    return OAuthUtils.buildAuthorizationUrl({
      clientId: DANGEROUS_unencryptedCredentials.clientId,
      redirectUri,
      scopes: d.connection.config.scopes,
      state: d.setup.stateIdentifier,
      codeChallenge,
      config
    });
  }

  async startAuthorization(d: {
    connection: RemoteOAuthConnection & {
      config: RemoteOAuthConfig;
    };
    serverOAuthSetup?: { callbackUrlOverride?: string | null } | null;
  }) {
    if (d.connection.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Connection is not active and cannot be used for authentication'
        })
      );
    }

    let i = 0;
    while (d.connection.discoveryStatus == 'discovering') {
      if (i++ > 100) {
        throw new ServiceError(
          badRequestError({
            message:
              'Connection setup is taking too long and cannot be used for authentication'
          })
        );
      }

      await delay(1000);

      d.connection = await db.remoteOAuthConnection.findFirstOrThrow({
        where: { oid: d.connection.oid },
        include: { config: true }
      });
    }

    if (d.connection.discoveryStatus == 'failed') {
      throw new ServiceError(
        badRequestError({
          message: 'Connection setup failed and cannot be used for authentication'
        })
      );
    }

    let config = d.connection.config.config as OAuthConfiguration;
    let supportsPKCE = !!config.code_challenge_methods_supported?.includes('S256');

    let setup = await db.remoteOAuthConnectionSetup.create({
      data: {
        ...getId('remoteOAuthConnectionSetup'),
        stateIdentifier: generatePlainId(32),

        status: 'pending',

        connectionOid: d.connection.oid,
        tenantOid: d.connection.tenantOid,

        codeVerifier: supportsPKCE ? OAuthUtils.generateCodeVerifier() : undefined
      },
      include: {
        tenant: true,
        serverOAuthSetup: {
          include: { serverInstanceConfiguration: true }
        }
      }
    });

    let redirectUrl = await this.buildAuthorizationRedirect({
      connection: d.connection,
      setup,
      serverOAuthSetup: d.serverOAuthSetup ?? setup.serverOAuthSetup
    });

    return {
      type: 'redirect' as const,
      setup,
      redirectUrl
    };
  }

  async resumeAuthorization(d: {
    connection: RemoteOAuthConnection & {
      config: RemoteOAuthConfig;
    };
    setup: RemoteOAuthConnectionSetup & {
      tenant: Tenant;
    };
    serverOAuthSetup: Pick<ServerOAuthSetup, 'callbackUrlOverride'>;
  }) {
    if (d.setup.status != 'pending') {
      throw new ServiceError(
        badRequestError({ message: 'OAuth authorization attempt is no longer pending' })
      );
    }

    return {
      type: 'redirect' as const,
      setup: d.setup,
      redirectUrl: await this.buildAuthorizationRedirect(d)
    };
  }

  async completeAuthorization(d: {
    fullUrl: string;

    response: {
      code?: string;
      state?: string;
      error?: string;
      errorDescription?: string;
    };
  }) {
    if (d.response.error) {
      if (d.response.state) {
        try {
          let res = await db.remoteOAuthConnectionSetup.update({
            where: {
              stateIdentifier: d.response.state!,
              status: 'pending'
            },
            data: {
              status: 'failed',
              stateIdentifier: null,

              errorCode: d.response.error,
              errorMessage:
                d.response.errorDescription ??
                oauthErrorDescriptions[d.response.error] ??
                d.response.error
            }
          });

          await db.serverOAuthSetup.updateMany({
            where: { remoteOAuthConnectionSetupOid: res.oid },
            data: { status: 'failed' }
          });

          let serverOAuthSetup = await db.serverOAuthSetup.findFirst({
            where: { remoteOAuthConnectionSetupOid: res.oid },
            select: { oid: true }
          });
          if (serverOAuthSetup) {
            await serverEventService.recordServerOAuthSetupEvent({
              serverOAuthSetup,
              type: 'oauth_setup_callback_failed',
              message:
                d.response.errorDescription ??
                oauthErrorDescriptions[d.response.error] ??
                d.response.error,
              payload: {
                errorCode: d.response.error
              }
            });
          }
        } catch {
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

    let attempt = await db.remoteOAuthConnectionSetup.findFirst({
      where: {
        stateIdentifier: d.response.state!,
        status: 'pending',
        createdAt: {
          gte: subMinutes(new Date(), 60 * 2)
        }
      },
      include: {
        connection: {
          include: { config: true, serverOAuthCredentials: true }
        },
        tenant: true,
        serverOAuthSetup: {
          include: { serverInstanceConfiguration: true }
        }
      }
    });
    if (!attempt || !attempt.connection.serverOAuthCredentials || !attempt.serverOAuthSetup) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid authorization attempt',
          description:
            'The provided state identifier does not match any pending attempts. Maybe the attempt has already been completed or expired.'
        })
      );
    }

    let connection = attempt.connection;
    let egressPolicy = attempt.serverOAuthSetup.serverInstanceConfiguration
      ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null;
    let redirectUri = getRemoteOAuthRedirectUri({
      connection,
      serverOAuthSetup: attempt.serverOAuthSetup
    });

    let tokenResponse: TokenResponse;
    let profile: RemoteOAuthConnectionProfile | null = null;

    let DANGEROUS_unencryptedCredentials =
      await remoteOAuthConnectionService.DANGEROUSLY_getCredentials({
        tenant: attempt.tenant,
        connection: attempt.connection
      });

    try {
      tokenResponse = await OAuthUtils.exchangeCodeForTokens({
        tokenEndpoint: connection.config.config.token_endpoint,
        clientId: DANGEROUS_unencryptedCredentials.clientId,
        clientSecret: DANGEROUS_unencryptedCredentials.clientSecret ?? undefined,
        code: d.response.code!,
        redirectUri,
        codeVerifier: attempt.codeVerifier ?? undefined,
        config: connection.config.config,
        egressPolicy
      });

      if (!tokenResponse.access_token) {
        throw new Error('Provider did not return `access_token`.');
      }
    } catch (error: any) {
      let res = await db.remoteOAuthConnectionSetup.update({
        where: {
          connectionOid: connection.oid,
          stateIdentifier: d.response.state!,
          status: 'pending'
        },
        data: {
          status: 'failed',
          stateIdentifier: null,

          errorCode: 'token_exchange_failed',
          errorMessage: `Failed to exchange authorization code for tokens: ${error.message}`
        }
      });

      await db.serverOAuthSetup.updateMany({
        where: { remoteOAuthConnectionSetupOid: res.oid },
        data: { status: 'failed' }
      });

      if (attempt.serverOAuthSetup) {
        await serverEventService.recordServerOAuthSetupEvent({
          serverOAuthSetup: attempt.serverOAuthSetup,
          type: 'oauth_setup_callback_failed',
          message: `Failed to exchange authorization code for tokens: ${error.message}`,
          payload: {
            errorCode: 'token_exchange_failed'
          }
        });
      }

      throw error;
    }

    let providerProfile: UserProfile | null = null;
    if (connection.config.config.userinfo_endpoint) {
      try {
        providerProfile = await OAuthUtils.getUserProfile({
          userInfoEndpoint: connection.config.config.userinfo_endpoint,
          accessToken: tokenResponse.access_token,
          egressPolicy
        });
      } catch (error) {
        // Ignore
      }
    }

    profile = providerProfile
      ? await db.remoteOAuthConnectionProfile.upsert({
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
            ...getId('remoteOAuthConnectionProfile'),

            connectionOid: connection.oid,
            tenantOid: connection.tenantOid,

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

    let secret = await secretService.createSecret({
      tenant: attempt.tenant,
      purpose: 'oauth_token',
      secretData: {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token
      }
    });

    let token = await db.remoteOAuthConnectionAuthToken.create({
      data: {
        ...getId('remoteOAuthConnectionAuthToken'),

        source: 'oauth',

        secretOid: secret.oid,

        configOid: connection.configOid,
        serverOid: connection.serverOid,

        tokenType: tokenResponse.token_type,
        expiresAt: expiresAt,
        idToken: tokenResponse.id_token || null,
        scope: tokenResponse.scope || null,

        connectionOid: connection.oid,
        connectionProfileOid: profile?.oid,
        tenantOid: connection.tenantOid
      }
    });

    let authConfig = await db.serverAuthConfig.create({
      data: {
        ...getId('serverAuthConfig'),
        type: 'remote',
        serverOid: connection.serverOid,
        tenantOid: connection.tenantOid,
        credentialsOid: connection.serverOAuthCredentials!.oid,
        remoteOAuthConnectionOid: connection.oid,
        remoteOAuthConnectionAuthTokenOid: token.oid
      }
    });

    await db.remoteOAuthConnectionSetup.updateMany({
      where: {
        connectionOid: connection.oid,
        stateIdentifier: d.response.state!,
        status: 'pending'
      },
      data: {
        status: 'completed',
        stateIdentifier: null,
        authTokenOid: token.oid,
        authConfigOid: authConfig.oid,
        profileOid: profile?.oid
      }
    });

    let setup = await db.serverOAuthSetup.update({
      where: { oid: attempt.serverOAuthSetup.oid },
      data: {
        status: 'completed',
        authConfigOid: authConfig.oid
      }
    });

    await serverEventService.recordServerOAuthSetupEvent({
      serverOAuthSetup: setup,
      type: 'oauth_setup_completed',
      message: 'Completed remote OAuth setup',
      payload: {
        authConfigId: authConfig.id
      }
    });

    let url = new URL(attempt.serverOAuthSetup.redirectUri);
    url.searchParams.set('metorial_token_type', 'oauth');
    url.searchParams.set('metorial_oauth_setup_id', setup.id);

    return {
      redirectUrl: url.toString()
    };
  }
}

export let remoteOauthAuthorizationService = Service.create(
  'remoteOauthAuthorization',
  () => new remoteOauthAuthorizationServiceImpl()
).build();
