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
import { normalizeScopes } from './oauthAuthorizationScopes';

export let ensureScopesAllowed = (d: {
  allowedScopes: string[];
  requestedScopes?: string[] | null;
}) => {
  let scopes = normalizeScopes(
    d.requestedScopes?.length ? d.requestedScopes : d.allowedScopes
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

export let ensureAuthorizationRequestPending = (
  oauthAuthorizationRequest: {
    status: 'pending' | 'accepted' | 'denied' | 'consumed';
    expiresAt: Date;
    oauthApplication: OAuthApplication;
  }
) => {
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
