import { badRequestError, ServiceError } from '@mtsrc/error';
import { generatePlainId } from '@mtsrc/id';
import { Service } from '@mtsrc/service';
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
import { normalizeAuthorizationUrl } from '../../../lib/oauth/normalizeAuthorizationUrl';
import { functionServerInvocationService } from '../../functionServerInvocation';
import { secretService } from '../../secret';
import { serverEventService } from '../serverEvent';
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

    let functionInvocation =
      await functionServerInvocationService.ensureFunctionServerInvocation({
        functionServer: setup.connection.functionServer,
        tenant: setup.tenant,
        functionInvocationId: res.functionCallId,
        isError: res.status == 'error' || !res.result
      });

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

      if (setup.serverOAuthSetup) {
        await serverEventService.recordServerOAuthSetupEvent({
          serverOAuthSetup: setup.serverOAuthSetup,
          type: 'oauth_setup_authorization_failed',
          message:
            res.error?.message ??
            'Failed to get authorization URL from function server. OAuth not supported by provider.',
          payload: {
            errorCode: res.error?.code ?? 'authorization_url_failed'
          },
          functionInvocationId:
            functionInvocation?.functionBayInvocationId ?? res.functionCallId
        });
      }

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

    if (setup.serverOAuthSetup) {
      await serverEventService.recordServerOAuthSetupEvent({
        serverOAuthSetup: setup.serverOAuthSetup,
        type: 'oauth_setup_authorization_url_generated',
        message: 'Generated delegated OAuth authorization URL',
        payload: {
          state: setup.stateIdentifier
        },
        functionInvocationId: functionInvocation?.functionBayInvocationId ?? res.functionCallId
      });
    }

    return {
      type: 'redirect' as const,
      setup,
      redirectUrl: normalizeAuthorizationUrl(res.result.authorizationUrl),
      functionInvocationId: functionInvocation?.functionBayInvocationId ?? res.functionCallId
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

          let serverOAuthSetup = await db.serverOAuthSetup.findFirst({
            where: { delegatedOAuthConnectionSetupOid: res.oid },
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

    let functionInvocation =
      await functionServerInvocationService.ensureFunctionServerInvocation({
        functionServer: connection.functionServer,
        tenant: setup.tenant,
        functionInvocationId: res.functionCallId,
        isError: res.status == 'error' || !res.result
      });

    if (res.status == 'error' || !res.result) {
      let updatedSetup = await db.delegatedOAuthConnectionSetup.update({
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
        where: { delegatedOAuthConnectionSetupOid: updatedSetup.oid },
        data: { status: 'failed' }
      });

      await serverEventService.recordServerOAuthSetupEvent({
        serverOAuthSetup: setup.serverOAuthSetup,
        type: 'oauth_setup_callback_failed',
        message: res.error?.message ?? 'Failed to complete authorization with OAuth provider',
        payload: {
          errorCode: res.error?.code ?? 'authorization_callback_failed'
        },
        functionInvocationId: functionInvocation?.functionBayInvocationId ?? res.functionCallId
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

    await serverEventService.recordServerOAuthSetupEvent({
      serverOAuthSetup: oauthSetup,
      type: 'oauth_setup_completed',
      message: 'Completed OAuth setup',
      payload: {
        authConfigId: authConfig.id
      },
      functionInvocationId: functionInvocation?.functionBayInvocationId ?? res.functionCallId
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
