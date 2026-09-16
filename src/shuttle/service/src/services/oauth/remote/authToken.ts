import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import { addMinutes, differenceInMinutes } from 'date-fns';
import type {
  RemoteOAuthConfig,
  RemoteOAuthConnection,
  RemoteOAuthConnectionAuthToken,
  ServerAuthConfig,
  Tenant
} from '../../../../prisma/generated/client';
import { db } from '../../../db';
import { env } from '../../../env';
import { getId } from '../../../id';
import { OAuthUtils } from '../../../lib/oauth/oauthUtils';
import type { OAuthRequestErrorDetails } from '../../../lib/oauth/oauthRequestError';
import { addRemoteErrorCheck } from '../../../queues/oauth/remoteErrorCheck';
import { secretService, type SecretOAuthToken } from '../../secret';
import { serverEventService } from '../serverEvent';
import { remoteOAuthConnectionService } from './connection';

let REFRESH_ERROR_COOLDOWN_MS = 60 * 1000;

let refreshLock = createLock({
  name: 'shuttle/oauth/remote-token/refresh',
  redisUrl: env.service.REDIS_URL
});

let getRefreshFailureCode = (error: OAuthRequestErrorDetails) => {
  if (!error.isTransient) return 'auth_token_refresh_failed';
  if (error.status == 429) return 'rate_limited';
  if (error.status == 408) return 'timeout';
  return 'connection_error';
};

let isInvalidClientCredentials = (error: OAuthRequestErrorDetails) =>
  error.oauthCode === 'invalid_client' || error.oauthCode === 'unauthorized_client';

let withRecoveryHint = (message: string, error: OAuthRequestErrorDetails) => {
  if (error.isTransient) return `${message}. Try again shortly.`;
  if (isInvalidClientCredentials(error)) {
    return `${message}. Configure valid OAuth client credentials and re-authenticate this connection.`;
  }

  return `${message}. Re-authenticate this connection to continue.`;
};

let refreshToken = async (d: {
  tenant: Tenant;
  token: RemoteOAuthConnectionAuthToken;
  serverAuthConfig?: ServerAuthConfig;
  connection: RemoteOAuthConnection & { config: RemoteOAuthConfig };
  DANGEROUS_secretData: SecretOAuthToken;
  serverConnectionId?: string;
}) => {
  // We start with the old token, but we replace this value later
  let token = d.token;
  let DANGEROUS_secretData = d.DANGEROUS_secretData;

  if (token.source != 'oauth') {
    throw new ServiceError(
      badRequestError({
        code: 'auth_token_refresh_failed',
        message: 'Cannot refresh foreign token from token import'
      })
    );
  }

  if (!DANGEROUS_secretData.refreshToken) {
    throw new ServiceError(
      badRequestError({
        code: 'auth_token_refresh_failed',
        message:
          'Provider authentication token has expired and cannot be refreshed. Please reauthenticate.'
      })
    );
  }

  let DANGEROUS_unencryptedCredentials =
    await remoteOAuthConnectionService.DANGEROUSLY_getCredentials({
      tenant: d.tenant,
      connection: d.connection
    });

  let res = await OAuthUtils.refreshAccessToken({
    tokenEndpoint: d.connection.config.config.token_endpoint,
    clientId: DANGEROUS_unencryptedCredentials.clientId,
    clientSecret: DANGEROUS_unencryptedCredentials.clientSecret,
    refreshToken: DANGEROUS_secretData.refreshToken,
    config: d.connection.config.config
  });

  if (!res.ok) {
    let errorCode = isInvalidClientCredentials(res.error)
      ? 'invalid_credentials'
      : getRefreshFailureCode(res.error);
    let errorMessage = withRecoveryHint(res.message, res.error);

    await db.remoteOAuthConnectionAuthToken.update({
      where: { oid: token.oid },
      data: {
        firstErrorAt: token.firstErrorAt ?? new Date(),
        lastErrorAt: new Date(),
        errorCount: { increment: 1 },
        errorDisabledAt: res.error.isTransient ? token.errorDisabledAt : new Date()
      }
    });

    await db.remoteOAuthConnectionAuthTokenError.create({
      data: {
        ...getId('remoteOAuthConnectionAuthTokenError'),
        authTokenOid: token.oid,
        errorCode,
        errorMessage
      }
    });

    if (d.serverAuthConfig) {
      await serverEventService.recordServerAuthConfigEvent({
        serverAuthConfig: d.serverAuthConfig,
        type: 'oauth_token_refresh_failed',
        message: errorMessage,
        payload: {
          errorCode,
          upstreamStatus: res.error.status,
          upstreamOAuthCode: res.error.oauthCode,
          retryable: res.error.isTransient,
          replayed: false
        },
        serverConnectionId: d.serverConnectionId
      });
    }

    await addRemoteErrorCheck(d.connection.id);

    throw new ServiceError(
      badRequestError({
        code: errorCode,
        message: errorMessage
      })
    );
  }

  let tokenResponse = res.response;

  DANGEROUS_secretData = Object.assign(DANGEROUS_secretData, {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || DANGEROUS_secretData.refreshToken
  });

  await secretService.DANGEROUSLY_updateSecret({
    secretOid: d.token.secretOid!,
    purpose: 'oauth_token',
    tenant: d.tenant,
    secretData: DANGEROUS_secretData
  });

  token = await db.remoteOAuthConnectionAuthToken.update({
    where: { oid: token.oid },
    data: {
      tokenType: tokenResponse.token_type,

      idToken: tokenResponse.id_token || undefined,
      scope: tokenResponse.scope || undefined,
      lastUsedAt: new Date(),
      refreshedAt: new Date(),

      firstErrorAt: null,
      lastErrorAt: null,
      errorCount: 0,
      errorDisabledAt: null,

      expiresAt: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null
    }
  });

  return {
    token,
    DANGEROUS_secretData
  };
};

let replayRefreshFailure = async (d: {
  token: RemoteOAuthConnectionAuthToken & {
    errors: { errorCode: string; errorMessage: string | null }[];
  };
  serverAuthConfig?: ServerAuthConfig;
  serverConnectionId?: string;
}) => {
  let latestError = d.token.errors[0];
  let isTransient = !d.token.errorDisabledAt;
  let errorCode = latestError?.errorCode ?? 'auth_token_refresh_failed';
  let errorMessage =
    latestError?.errorMessage ??
    (isTransient
      ? 'OAuth token refresh failed. Try again shortly.'
      : 'OAuth token refresh failed. Re-authenticate this connection to continue.');

  if (d.serverAuthConfig) {
    await serverEventService.recordServerAuthConfigEvent({
      serverAuthConfig: d.serverAuthConfig,
      type: 'oauth_token_refresh_failed',
      message: errorMessage,
      payload: {
        errorCode,
        retryable: isTransient,
        replayed: true
      },
      serverConnectionId: d.serverConnectionId
    });
  }

  throw new ServiceError(
    badRequestError({
      code: errorCode,
      message: errorMessage
    })
  );
};

let shouldRefreshToken = (token: RemoteOAuthConnectionAuthToken) => {
  let lastRefreshAt = token.refreshedAt ?? token.lastUsedAt;
  let duration = differenceInMinutes(new Date(), lastRefreshAt);
  let expiryWindow = duration < 10 ? new Date() : addMinutes(new Date(), 10);

  return !!token.expiresAt && token.expiresAt.getTime() < expiryWindow.getTime();
};

class remoteAuthTokenServiceImpl {
  async useAuthToken(d: {
    tenant: Tenant;
    remoteOAuthConnectionAuthTokenOid: bigint;
    serverAuthConfig?: ServerAuthConfig;
    serverConnectionId?: string;
  }) {
    let getToken = async () =>
      await db.remoteOAuthConnectionAuthToken.findFirstOrThrow({
        where: { oid: d.remoteOAuthConnectionAuthTokenOid, tenantOid: d.tenant.oid },
        include: {
          connection: { include: { config: true } },
          errors: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      });

    let decryptToken = async (token: Awaited<ReturnType<typeof getToken>>) =>
      await secretService.DANGEROUSLY_decryptSecret({
        secretOid: token.secretOid,
        purpose: 'oauth_token',
        tenant: d.tenant,
        note: `roat.use:${token.id}`
      });

    let buildResult = (
      token: Awaited<ReturnType<typeof getToken>>,
      DANGEROUS_secretData: SecretOAuthToken,
      didRefresh: boolean
    ) => ({
      token,
      didRefresh,

      id: token.id,
      accessToken: DANGEROUS_secretData.accessToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      idToken: token.idToken,
      scope: token.scope
    });

    let token = await getToken();

    if (Math.abs(differenceInMinutes(token.lastUsedAt, new Date())) > 5) {
      await db.remoteOAuthConnectionAuthToken.updateMany({
        where: { oid: token.oid },
        data: { lastUsedAt: new Date() }
      });
    }

    if (!shouldRefreshToken(token)) {
      let DANGEROUS_secretData = await decryptToken(token);
      return buildResult(token, DANGEROUS_secretData, false);
    }

    return await refreshLock.usingLock(
      token.id,
      async () => {
        token = await getToken();

        if (!shouldRefreshToken(token)) {
          let DANGEROUS_secretData = await decryptToken(token);
          return buildResult(token, DANGEROUS_secretData, false);
        }

        let isCoolingDown =
          token.lastErrorAt &&
          Date.now() - token.lastErrorAt.getTime() < REFRESH_ERROR_COOLDOWN_MS;

        if (token.errorDisabledAt || isCoolingDown) {
          return await replayRefreshFailure({
            token,
            serverAuthConfig: d.serverAuthConfig,
            serverConnectionId: d.serverConnectionId
          });
        }

        if (token.source != 'oauth' || !token.connection) {
          throw new ServiceError(
            badRequestError({
              code: 'auth_token_refresh_failed',
              message: 'Cannot refresh foreign token from token import',
              description:
                'The token you are using is managed externally and cannot be refreshed by Metorial. Please create a new token import to refresh the token.',
              hint: 'Use the token import flow to refresh the token.'
            })
          );
        }

        let DANGEROUS_secretData = await decryptToken(token);
        let refreshRes = await refreshToken({
          token,
          connection: token.connection,
          tenant: d.tenant,
          DANGEROUS_secretData,
          serverAuthConfig: d.serverAuthConfig,
          serverConnectionId: d.serverConnectionId
        });

        DANGEROUS_secretData = refreshRes.DANGEROUS_secretData;
        token = { ...token, ...refreshRes.token, errors: [] };

        if (d.serverAuthConfig) {
          await serverEventService.recordServerAuthConfigEvent({
            serverAuthConfig: d.serverAuthConfig,
            type: 'oauth_token_refresh_succeeded',
            message: 'Successfully refreshed remote OAuth token',
            payload: {
              authTokenId: token.id
            },
            serverConnectionId: d.serverConnectionId
          });
        }

        return buildResult(token, DANGEROUS_secretData, true);
      },
      {
        durationMs: 20_000,
        acquisitionTimeoutMs: 20_000
      }
    );
  }
}

export let remoteAuthTokenService = Service.create(
  'remoteAuthTokenService',
  () => new remoteAuthTokenServiceImpl()
).build();
