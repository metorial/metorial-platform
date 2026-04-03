import {
  badRequestError,
  forbiddenError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import {
  MachineAccess,
  OAuthApplication,
  OAuthAuthorization,
  OAuthInstallation,
  OAuthToken
} from '@metorial/db';
import { addMinutes } from 'date-fns';
import { normalizeScopes } from './oauthAuthorizationScopes';

let OAUTH_TOKEN_REFRESH_RATE_LIMIT_MINUTES = 10;

export let ensureScopesAllowed = (d: {
  allowedScopes: string[];
  requestedScopes?: string[] | null;
}) => {
  let scopes = normalizeScopes(
    d.requestedScopes === undefined || d.requestedScopes === null
      ? d.allowedScopes
      : d.requestedScopes
  );

  if (!scopes.every(scope => d.allowedScopes.includes(scope))) {
    throw new ServiceError(
      badRequestError({
        message: 'Requested scopes are not allowed for this oauth application'
      })
    );
  }

  return scopes;
};

export let ensureAuthorizationRequestPending = (oauthAuthorizationRequest: {
  status: 'pending' | 'accepted' | 'denied' | 'consumed';
  expiresAt: Date;
  oauthApplication: OAuthApplication;
}) => {
  if (oauthAuthorizationRequest.oauthApplication.status != 'active') {
    throw new ServiceError(
      forbiddenError({
        message: 'OAuth application is not active'
      })
    );
  }

  if (oauthAuthorizationRequest.status != 'pending') {
    throw new ServiceError(
      badRequestError({
        message: 'OAuth authorization request can no longer be accepted'
      })
    );
  }

  if (oauthAuthorizationRequest.expiresAt < new Date()) {
    throw new ServiceError(
      badRequestError({
        message: 'OAuth authorization request has expired'
      })
    );
  }
};

export let ensureAuthorizationUsable = (
  oauthAuthorization: OAuthAuthorization & {
    oauthApplication: OAuthApplication;
    oauthInstallation: OAuthInstallation;
    machineAccess: MachineAccess;
  }
) => {
  if (
    oauthAuthorization.status != 'active' ||
    oauthAuthorization.oauthApplication.status != 'active' ||
    oauthAuthorization.oauthInstallation.status != 'active' ||
    oauthAuthorization.machineAccess.status != 'active'
  ) {
    throw new ServiceError(
      unauthorizedError({
        message: 'OAuth authorization is revoked or inactive'
      })
    );
  }
};

export let ensureTokenRefreshable = (
  oauthToken: OAuthToken & {
    oauthAuthorization: OAuthAuthorization & {
      oauthApplication: OAuthApplication;
      oauthInstallation: OAuthInstallation;
      machineAccess: MachineAccess;
    };
  }
) => {
  ensureAuthorizationUsable(oauthToken.oauthAuthorization);

  if (oauthToken.completelyExpiresAt && oauthToken.completelyExpiresAt < new Date()) {
    throw new ServiceError(
      unauthorizedError({
        message: 'OAuth token can no longer be refreshed or used'
      })
    );
  }

  if (
    oauthToken.lastRefreshedAt &&
    addMinutes(oauthToken.lastRefreshedAt, OAUTH_TOKEN_REFRESH_RATE_LIMIT_MINUTES) > new Date()
  ) {
    throw new ServiceError(
      unauthorizedError({
        message: 'OAuth token can only be refreshed once every 10 minutes',
        oauth: {
          error: 'invalid_grant',
          errorMessage: 'OAuth token can only be refreshed once every 10 minutes'
        }
      })
    );
  }
};

export let ensureTokenUsable = (
  oauthToken: OAuthToken & {
    oauthAuthorization: OAuthAuthorization & {
      oauthApplication: OAuthApplication;
      oauthInstallation: OAuthInstallation;
      machineAccess: MachineAccess;
    };
  }
) => {
  ensureTokenRefreshable(oauthToken);

  if (oauthToken.accessTokenExpiresAt < new Date()) {
    throw new ServiceError(
      unauthorizedError({
        message: 'OAuth access token has expired'
      })
    );
  }
};
