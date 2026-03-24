import { badRequestError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import { addMinutes, differenceInDays, differenceInMinutes } from 'date-fns';
import type {
  RemoteOAuthConfig,
  RemoteOAuthConnection,
  RemoteOAuthConnectionAuthToken,
  Tenant
} from '../../../../prisma/generated/client';
import { db } from '../../../db';
import { OAuthUtils } from '../../../lib/oauth/oauthUtils';
import { addRemoteErrorCheck } from '../../../queues/oauth/remoteErrorCheck';
import { secretService, type SecretOAuthToken } from '../../secret';
import { remoteOAuthConnectionService } from './connection';

let Sentry = getSentry();

let refreshToken = async (d: {
  tenant: Tenant;
  token: RemoteOAuthConnectionAuthToken;
  connection: RemoteOAuthConnection & { config: RemoteOAuthConfig };
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

  if (!DANGEROUS_secretData.refreshToken) {
    throw new ServiceError(
      badRequestError({
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
    let update = await db.remoteOAuthConnectionAuthToken.update({
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

    await addRemoteErrorCheck(d.connection.id);

    throw new ServiceError(
      badRequestError({
        message: `Failed to refresh access token`
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

class remoteAuthTokenServiceImpl {
  async useAuthToken(d: { tenant: Tenant; remoteOAuthConnectionAuthTokenOid: bigint }) {
    let token = await db.remoteOAuthConnectionAuthToken.findFirstOrThrow({
      where: { oid: d.remoteOAuthConnectionAuthTokenOid, tenantOid: d.tenant.oid },
      include: {
        connection: { include: { config: true } }
      }
    });

    if (Math.abs(differenceInMinutes(token.lastUsedAt, new Date())) > 5) {
      await db.remoteOAuthConnectionAuthToken.updateMany({
        where: { oid: token.oid },
        data: { lastUsedAt: new Date() }
      });
    }

    let DANGEROUS_secretData = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: token.secretOid!,
      purpose: 'oauth_token',
      tenant: d.tenant
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
        DANGEROUS_secretData
      });

      DANGEROUS_secretData = refreshRes.DANGEROUS_secretData;
      token = { ...token, ...refreshRes.token };
      didRefresh = true;
    }

    if (token.errorCount) {
      (async () => {
        await db.remoteOAuthConnectionAuthToken.updateMany({
          where: { oid: token.oid },
          data: {
            firstErrorAt: null,
            lastErrorAt: null,
            errorCount: 0,
            errorDisabledAt: null
          }
        });

        // await db.remoteOAuthConnectionSetup.updateMany({
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

export let remoteAuthTokenService = Service.create(
  'remoteAuthTokenService',
  () => new remoteAuthTokenServiceImpl()
).build();
