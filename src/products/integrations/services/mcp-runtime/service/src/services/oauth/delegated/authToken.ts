import { badRequestError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import { addMinutes, differenceInDays, differenceInMinutes } from 'date-fns';
import type {
  DelegatedOAuthConfig,
  DelegatedOAuthConnection,
  DelegatedOAuthConnectionAuthToken,
  FunctionServer,
  ServerAuthConfig,
  Tenant
} from '../../../../prisma/generated/client';
import { db } from '../../../db';
import { getId } from '../../../id';
import { callFunction } from '../../../lib/function/call';
import { addDelegatedErrorCheck } from '../../../queues/oauth/delegatedErrorCheck';
import { functionServerInvocationService } from '../../functionServerInvocation';
import { secretService, type SecretOAuthToken } from '../../secret';
import { serverEventService } from '../serverEvent';
import { delegatedOAuthConnectionService } from './connection';

let Sentry = getSentry();

let refreshToken = async (d: {
  tenant: Tenant;
  token: DelegatedOAuthConnectionAuthToken;
  serverAuthConfig?: ServerAuthConfig;
  connection: DelegatedOAuthConnection & {
    config: DelegatedOAuthConfig;
    functionServer: FunctionServer;
  };
  DANGEROUS_secretData: SecretOAuthToken;
}) => {
  // We start with the old token, but we replace this value later
  let token = d.token;
  let DANGEROUS_secretData = d.DANGEROUS_secretData;

  if (token.source != 'oauth') {
    throw new ServiceError(
      badRequestError({
        message: 'Cannot refresh foreign token from token import'
      })
    );
  }

  if (!d.connection.config.supportsOauthTokenRefresh) {
    throw new ServiceError(
      badRequestError({
        message: 'This OAuth provider does not support token refresh. Please reauthenticate.'
      })
    );
  }

  if (!DANGEROUS_secretData.refreshToken) {
    throw new ServiceError(
      badRequestError({
        message:
          'Provider authentication token has expired and cannot be refreshed. Please reauthenticate.'
      })
    );
  }

  let DANGEROUS_unencryptedCredentials =
    await delegatedOAuthConnectionService.DANGEROUSLY_getCredentials({
      tenant: d.tenant,
      connection: d.connection
    });

  let res = await callFunction(d.connection.functionServer, {}, client =>
    client.handleOauthTokenRefresh({
      authConfig: token.authConfigValue,
      authState: token.authStateValue,
      refreshToken: DANGEROUS_secretData.refreshToken!,
      clientId: DANGEROUS_unencryptedCredentials.clientId,
      clientSecret: DANGEROUS_unencryptedCredentials.clientSecret!
    })
  );

  let functionInvocation =
    await functionServerInvocationService.ensureFunctionServerInvocation({
      functionServer: d.connection.functionServer,
      tenant: d.tenant,
      functionInvocationId: res.functionCallId,
      isError: res.status == 'error' || !res.result
    });

  if (res.status == 'error' || !res.result) {
    await db.delegatedOAuthConnectionAuthToken.update({
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

    await db.delegatedOAuthConnectionAuthTokenError.create({
      data: {
        ...getId('delegatedOAuthConnectionAuthTokenError'),
        authTokenOid: token.oid,
        errorCode: res.error?.code ?? 'token_refresh_failed',
        errorMessage: res.error?.message ?? 'Provider does not support token refresh',
        functionInvocationId: res.functionCallId
      }
    });

    if (d.serverAuthConfig) {
      await serverEventService.recordServerAuthConfigEvent({
        serverAuthConfig: d.serverAuthConfig,
        type: 'oauth_token_refresh_failed',
        message: res.error?.message ?? 'Provider does not support token refresh',
        payload: {
          errorCode: res.error?.code ?? 'token_refresh_failed'
        },
        functionInvocationId: functionInvocation?.functionBayInvocationId ?? res.functionCallId
      });
    }

    await addDelegatedErrorCheck(d.connection.id);

    throw new ServiceError(
      badRequestError({
        message: `Failed to refresh access token`
      })
    );
  }

  let tokenResponse = res.result;

  DANGEROUS_secretData = Object.assign(DANGEROUS_secretData, {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken || DANGEROUS_secretData.refreshToken
  });

  await secretService.DANGEROUSLY_updateSecret({
    secretOid: d.token.secretOid!,
    purpose: 'oauth_token',
    tenant: d.tenant,
    secretData: DANGEROUS_secretData
  });

  token = await db.delegatedOAuthConnectionAuthToken.update({
    where: { oid: token.oid },
    data: {
      tokenType: tokenResponse.tokenType || undefined,
      idToken: tokenResponse.idToken || undefined,
      scope: tokenResponse.scope || undefined,
      lastUsedAt: new Date(),
      refreshedAt: new Date(),

      expiresAt: tokenResponse.expiresIn
        ? new Date(Date.now() + tokenResponse.expiresIn * 1000)
        : null
    }
  });

  return {
    token,
    DANGEROUS_secretData,
    functionInvocationId: functionInvocation?.functionBayInvocationId ?? res.functionCallId
  };
};

class delegatedAuthTokenServiceImpl {
  async useAuthToken(d: {
    tenant: Tenant;
    delegatedOAuthConnectionAuthTokenOid: bigint;
    serverAuthConfig?: ServerAuthConfig;
  }) {
    let token = await db.delegatedOAuthConnectionAuthToken.findFirstOrThrow({
      where: { oid: d.delegatedOAuthConnectionAuthTokenOid, tenantOid: d.tenant.oid },
      include: {
        connection: { include: { config: true, functionServer: true } }
      }
    });

    if (Math.abs(differenceInMinutes(token.lastUsedAt, new Date())) > 5) {
      await db.delegatedOAuthConnectionAuthToken.updateMany({
        where: { oid: token.oid },
        data: { lastUsedAt: new Date() }
      });
    }

    let DANGEROUS_secretData = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: token.secretOid!,
      purpose: 'oauth_token',
      tenant: d.tenant,
      note: `doat.use:${token.id}`
    });

    let didRefresh = false;

    let lastRefreshAt = token.refreshedAt ?? token.lastUsedAt;
    let duration = differenceInMinutes(new Date(), lastRefreshAt);
    let expiryWindow = duration < 10 ? new Date() : addMinutes(new Date(), 10);

    if (token.expiresAt && token.expiresAt.getTime() < expiryWindow.getTime()) {
      if (token.source != 'oauth' || !token.connection) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot refresh foreign token from token import',
            description:
              'The token you are using is managed externally and cannot be refreshed by Metorial. Please create a new token import to refresh the token.',
            hint: 'Use the token import flow to refresh the token.'
          })
        );
      }

      let refreshRes = await refreshToken({
        token,
        connection: token.connection,
        tenant: d.tenant,
        DANGEROUS_secretData,
        serverAuthConfig: d.serverAuthConfig
      });

      DANGEROUS_secretData = refreshRes.DANGEROUS_secretData;
      token = { ...token, ...refreshRes.token };
      didRefresh = true;

      if (d.serverAuthConfig) {
        await serverEventService.recordServerAuthConfigEvent({
          serverAuthConfig: d.serverAuthConfig,
          type: 'oauth_token_refresh_succeeded',
          message: 'Successfully refreshed OAuth token',
          payload: {
            authTokenId: token.id
          },
          functionInvocationId: refreshRes.functionInvocationId
        });
      }
    }

    if (token.errorCount) {
      (async () => {
        await db.delegatedOAuthConnectionAuthToken.updateMany({
          where: { oid: token.oid },
          data: {
            firstErrorAt: null,
            lastErrorAt: null,
            errorCount: 0,
            errorDisabledAt: null
          }
        });

        // await db.delegatedOAuthConnectionSetup.updateMany({
        //   where: { authTokenOid: token.oid },
        //   data: { associatedTokenErrorDisabledAt: null }
        // });
      })().catch(e => Sentry.captureException(e));
    }

    return {
      token,
      didRefresh,

      id: token.id,
      accessToken: DANGEROUS_secretData.accessToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      idToken: token.idToken,
      scope: token.scope
    };
  }
}

export let delegatedAuthTokenService = Service.create(
  'delegatedAuthTokenService',
  () => new delegatedAuthTokenServiceImpl()
).build();
