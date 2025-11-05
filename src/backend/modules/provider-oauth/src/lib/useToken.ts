import {
  Instance,
  ProviderOAuthConfig,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthToken,
  ProviderOAuthConnectionAuthTokenReference,
  db
} from '@metorial/db';
import { ServiceError, badRequestError } from '@metorial/error';
import { usageService } from '@metorial/module-usage';
import { getSentry } from '@metorial/sentry';
import { getAxiosSsrfFilter } from '@metorial/ssrf';
import axios from 'axios';
import { addMinutes, differenceInDays, differenceInMinutes } from 'date-fns';
import { callbackUrl } from '../const';
import { addErrorCheck } from '../queue/errorCheck';
import { tokenResponseValidator } from '../types';
import { OAuthUtils } from './oauthUtils';

let Sentry = getSentry();

let getToken = async (
  d: { instance: Instance } & ({ referenceOid: bigint } | { tokenOid: bigint })
) => {
  if ('referenceOid' in d) {
    if (!d.referenceOid) throw new Error('WTF - Invalid reference OID');

    let ref = await db.providerOAuthConnectionAuthTokenReference.findUnique({
      where: { oid: d.referenceOid },
      include: {
        authToken: {
          include: {
            connection: {
              include: {
                config: true
              }
            }
          }
        }
      }
    });
    if (!ref || !ref.authToken) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider authentication token has expired. Please reauthenticate.'
        })
      );
    }

    return {
      ref: ref as ProviderOAuthConnectionAuthTokenReference,
      connection: ref.authToken.connection,
      token: ref.authToken as ProviderOAuthConnectionAuthToken
    };
  }

  if (!d.tokenOid) throw new Error('WTF - Invalid token OID');

  let tkn = await db.providerOAuthConnectionAuthToken.findUnique({
    where: { oid: d.tokenOid },
    include: {
      connection: {
        include: {
          config: true
        }
      }
    }
  });

  if (!tkn) {
    throw new ServiceError(
      badRequestError({
        message: 'Provider authentication token has expired. Please reauthenticate.'
      })
    );
  }

  return {
    ref: null,
    connection: tkn.connection,
    token: tkn as ProviderOAuthConnectionAuthToken
  };
};

let refreshToken = async (d: {
  token: ProviderOAuthConnectionAuthToken;
  connection: ProviderOAuthConnection & { config: ProviderOAuthConfig };
  ref: ProviderOAuthConnectionAuthTokenReference | null;
}) => {
  // We start with the old token, but we replace this value later
  let token = d.token;

  if (token.type == 'take_in') {
    throw new ServiceError(
      badRequestError({
        message: 'Cannot refresh foreign token from token take in'
      })
    );
  }

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
        if (d.ref) {
          await db.providerOAuthConnectionAuthTokenReference.update({
            where: { oid: d.ref.oid },
            data: { authTokenOid: otherToken.oid }
          });
        }

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

  let res: Awaited<ReturnType<typeof OAuthUtils.refreshAccessToken>>;
  let additionalAuthData: Record<string, any> = {};

  if (d.connection.config.type == 'json') {
    res = await OAuthUtils.refreshAccessToken({
      tokenEndpoint: d.connection.config.config.token_endpoint,
      clientId: d.connection.clientId!,
      clientSecret: d.connection.clientSecret ?? undefined,
      refreshToken: token.refreshToken,
      config: d.connection.config.config
    });
  } else if (d.connection.config.type == 'managed_server_http') {
    if (!d.connection.config.lambdaServerInstanceForHttpEndpointOid) {
      throw new Error(
        'WTF - Remote OAuth configuration is missing lambdaServerInstanceForHttpEndpointOid'
      );
    }

    let lambdaInstance = await db.lambdaServerInstance.findUniqueOrThrow({
      where: { oid: d.connection.config.lambdaServerInstanceForHttpEndpointOid },
      include: { instance: { include: { organization: true } } }
    });

    let tokenRes = await axios.post<Record<any, any>>(
      `${d.connection.config.httpEndpoint}/oauth/refresh`,
      {
        input: {
          redirectUri: callbackUrl,
          refreshToken: token.refreshToken,
          clientId: d.connection.clientId!,
          clientSecret: d.connection.clientSecret,
          fields: token.additionalValuesFromAuthAttempt ?? {}
        }
      },
      {
        ...getAxiosSsrfFilter(d.connection.config.httpEndpoint!),
        headers: {
          'metorial-stellar-token': lambdaInstance.securityToken
        }
      }
    );
    if (tokenRes.status !== 200 || !tokenRes.data.success) {
      res = { ok: false as const, message: 'Failed to fetch tokens from remote server' };
    } else {
      let tokenResVal = tokenResponseValidator.validate(tokenRes.data.authData);
      if (!tokenResVal.success) {
        res = {
          ok: false as const,
          message: 'Callback implementation returned an invalid token response'
        };
      } else {
        let tokenResponse = {
          access_token: tokenResVal.value.access_token,
          token_type: tokenResVal.value.token_type,
          expires_in: tokenResVal.value.expires_in,
          refresh_token: tokenResVal.value.refresh_token,
          id_token: tokenResVal.value.id_token,
          scope: tokenResVal.value.scope
        };

        additionalAuthData = { ...tokenRes.data.authData };
        for (let key of Object.keys(tokenResponse)) {
          delete additionalAuthData[key];
        }

        res = {
          ok: true as const,
          response: tokenResponse
        };
      }
    }
  } else {
    throw new Error('WTF - Unknown connection config type');
  }

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

      await addErrorCheck(d.connection.id);

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
      lastUsedAt: new Date(),
      refreshedAt: tokenResponse.refresh_token != token.refreshToken ? new Date() : undefined,
      additionalAuthData: {
        ...(token.additionalAuthData ?? {}),
        ...additionalAuthData
      }
    }
  });
};

export let useAuthToken = async (
  d: { instance: Instance } & ({ referenceOid: bigint } | { tokenOid: bigint })
) => {
  let { token, connection, ref } = await getToken(d);

  if (Math.abs(differenceInMinutes(token.lastUsedAt, new Date())) > 5) {
    await db.providerOAuthConnectionAuthToken.updateMany({
      where: { oid: token.oid },
      data: { lastUsedAt: new Date() }
    });
  }

  let lastRefreshAt = token.refreshedAt ?? token.lastUsedAt;
  let duration = differenceInMinutes(new Date(), lastRefreshAt);
  let expiryWindow = duration < 10 ? new Date() : addMinutes(new Date(), 10);

  if (token.expiresAt && token.expiresAt.getTime() < expiryWindow.getTime()) {
    if (token.type == 'take_in') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot refresh foreign token from token take in',
          description:
            'The token you are using is managed externally and cannot be refreshed by Metorial. Please create a new token take in to refresh the token.',
          hint: 'Use the token take in flow to refresh the token.'
        })
      );
    }

    token = await refreshToken({
      token,
      connection,
      ref
    });
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
    token,

    id: token.id,
    accessToken: token.accessToken,
    tokenType: token.tokenType,
    expiresAt: token.expiresAt,
    idToken: token.idToken,
    scope: token.scope,
    additionalAuthData: token.additionalAuthData,
    fields: token.additionalValuesFromAuthAttempt,
    connection
  };
};
