import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { subMinutes } from 'date-fns';
import type {
  DelegatedOAuthConfig,
  DelegatedOAuthConnection
} from '../../../../prisma/generated/client';
import { oauthCallbackUrl } from '../../../config';
import { db } from '../../../db';
import { getId } from '../../../id';
import { callFunction } from '../../../lib/function/call';
import { oauthErrorDescriptions } from '../../../lib/oauth/oauthErrors';
import { secretService } from '../../secret';
import { delegatedOAuthConnectionService } from './connection';

class delegatedOauthAuthorizationServiceImpl {
  async startAuthorization(d: {
    connection: DelegatedOAuthConnection & {
      config: DelegatedOAuthConfig;
    };

    authConfig: PrismaJson.DelegatedOAuthConnectionAuthConfig;
  }) {
    if (d.connection.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Connection is not active and cannot be used for authentication'
        })
      );
    }

    let setup = await db.delegatedOAuthConnectionSetup.create({
      data: {
        ...getId('delegatedOAuthConnectionSetup'),
        stateIdentifier: generatePlainId(32),
        status: 'pending',

        authConfigValue: d.authConfig,
        authStateValue: {},

        connectionOid: d.connection.oid,
        tenantOid: d.connection.tenantOid
      },
      include: {
        tenant: true,
        connection: {
          include: { functionServer: true }
        },
        serverOAuthSetup: true
      }
    });

    let DANGEROUS_unencryptedCredentials =
      await delegatedOAuthConnectionService.DANGEROUSLY_getCredentials({
        tenant: setup.tenant,
        connection: d.connection
      });

    let res = await callFunction(setup.connection.functionServer, client =>
      client.getOauthAuthorizationUrl({
        authConfig: d.authConfig,
        clientId: DANGEROUS_unencryptedCredentials.clientId,
        clientSecret: DANGEROUS_unencryptedCredentials.clientSecret!,
        state: setup.stateIdentifier!,
        redirectUri: setup.serverOAuthSetup?.callbackUrlOverride ?? oauthCallbackUrl
      })
    );

    if (res.status == 'error' || !res.result) {
      await db.delegatedOAuthConnectionSetup.update({
        where: { oid: setup.oid },
        data: {
          status: 'failed',
          errorCode: res.error?.code ?? 'authorization_url_failed',
          errorMessage:
            res.error?.message ??
            'Failed to get authorization URL from function server. OAuth not supported by provider.'
        }
      });

      throw new ServiceError(
        badRequestError({
          message: 'Failed to authenticate with OAuth provider'
        })
      );
    }

    await db.delegatedOAuthConnectionSetup.updateMany({
      where: { oid: setup.oid },
      data: { authStateValue: res.result.authState ?? undefined }
    });

    return {
      type: 'redirect' as const,
      setup,
      redirectUrl: res.result.authorizationUrl
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
          let res = await db.delegatedOAuthConnectionSetup.update({
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
            where: { delegatedOAuthConnectionSetupOid: res.oid },
            data: { status: 'failed' }
          });
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

    let setup = await db.delegatedOAuthConnectionSetup.findFirst({
      where: {
        stateIdentifier: d.response.state!,
        status: 'pending',
        createdAt: {
          gte: subMinutes(new Date(), 60 * 2)
        }
      },
      include: {
        connection: {
          include: { config: true, serverOAuthCredentials: true, functionServer: true }
        },
        tenant: true,
        serverOAuthSetup: true
      }
    });
    if (!setup || !setup.connection.serverOAuthCredentials || !setup.serverOAuthSetup) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid authorization attempt',
          description:
            'The provided state identifier does not match any pending attempts. Maybe the attempt has already been completed or expired.'
        })
      );
    }

    let connection = setup.connection;

    let DANGEROUS_unencryptedCredentials =
      await delegatedOAuthConnectionService.DANGEROUSLY_getCredentials({
        tenant: setup.tenant,
        connection: setup.connection
      });

    let res = await callFunction(connection.functionServer, client =>
      client.handleOauthCallback({
        authConfig: setup.authConfigValue,
        authState: setup.authStateValue,
        clientId: DANGEROUS_unencryptedCredentials.clientId,
        clientSecret: DANGEROUS_unencryptedCredentials.clientSecret!,
        code: d.response.code!,
        state: d.response.state!,
        redirectUri: setup.serverOAuthSetup?.callbackUrlOverride ?? oauthCallbackUrl,
        callbackUrl: d.fullUrl,
        authorizationUrl: ''
      })
    );

    if (res.status == 'error' || !res.result) {
      let setup = await db.delegatedOAuthConnectionSetup.update({
        where: {
          connectionOid: connection.oid,
          stateIdentifier: d.response.state!,
          status: 'pending'
        },
        data: {
          status: 'failed',
          stateIdentifier: null,

          errorCode: res.error?.code ?? 'authorization_callback_failed',
          errorMessage:
            res.error?.message ?? 'Failed to complete authorization with OAuth provider'
        }
      });

      await db.serverOAuthSetup.updateMany({
        where: { delegatedOAuthConnectionSetupOid: setup.oid },
        data: { status: 'failed' }
      });

      throw new ServiceError(
        badRequestError({
          message: 'Failed to complete authorization with OAuth provider'
        })
      );
    }

    let tokenResponse = res.result;

    let expiresAt = tokenResponse.expiresIn
      ? new Date(Date.now() + tokenResponse.expiresIn * 1000)
      : undefined;

    let secret = await secretService.createSecret({
      tenant: setup.tenant,
      purpose: 'oauth_token',
      secretData: {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken
      }
    });

    let token = await db.delegatedOAuthConnectionAuthToken.create({
      data: {
        ...getId('delegatedOAuthConnectionAuthToken'),

        source: 'oauth',

        authConfigValue: setup.authConfigValue,
        authStateValue: setup.authStateValue,

        expiresAt: expiresAt,
        tokenType: tokenResponse.tokenType || null,
        scope: tokenResponse.scope || null,
        idToken: tokenResponse.idToken || null,

        secretOid: secret.oid,
        connectionOid: connection.oid,
        configOid: connection.configOid,
        serverOid: connection.serverOid,
        tenantOid: connection.tenantOid
      }
    });

    let authConfig = await db.serverAuthConfig.create({
      data: {
        ...getId('serverAuthConfig'),
        type: 'delegated',
        serverOid: connection.serverOid,
        tenantOid: connection.tenantOid,
        credentialsOid: connection.serverOAuthCredentials!.oid,
        delegatedOAuthConnectionOid: connection.oid,
        delegatedOAuthConnectionAuthTokenOid: token.oid
      }
    });

    await db.delegatedOAuthConnectionSetup.updateMany({
      where: {
        connectionOid: connection.oid,
        stateIdentifier: d.response.state!,
        status: 'pending'
      },
      data: {
        status: 'completed',
        stateIdentifier: null,
        authTokenOid: token.oid,
        authConfigOid: authConfig.oid
      }
    });

    let oauthSetup = await db.serverOAuthSetup.update({
      where: { oid: setup.serverOAuthSetup.oid },
      data: {
        status: 'completed',
        authConfigOid: authConfig.oid
      }
    });

    let url = new URL(setup.serverOAuthSetup.redirectUri);
    url.searchParams.set('metorial_token_type', 'oauth');
    url.searchParams.set('metorial_oauth_setup_id', oauthSetup.id);

    return {
      redirectUrl: url.toString()
    };
  }
}

export let delegatedOauthAuthorizationService = Service.create(
  'delegatedOauthAuthorization',
  () => new delegatedOauthAuthorizationServiceImpl()
).build();
