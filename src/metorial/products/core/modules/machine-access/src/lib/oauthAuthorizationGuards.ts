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
  OAuthToken,
  OrganizationMember
} from '@metorial/db';
import { normalizeScopes } from './oauthAuthorizationScopes';

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
        message: 'Requested scopes are not allowed for this oauth application',
        oauth: {
          error: 'invalid_scope',
          errorMessage: 'Requested scopes are not allowed for this oauth application'
        }
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

type GuardedOAuthAuthorization = OAuthAuthorization & {
  oauthApplication: OAuthApplication;
  oauthInstallation: OAuthInstallation;
  machineAccess: MachineAccess;
  organizationMember?: OrganizationMember | null;
};

type GuardedOAuthToken = OAuthToken & { oauthAuthorization: GuardedOAuthAuthorization };

let isAuthorizationActive = (oauthAuthorization: GuardedOAuthAuthorization) =>
  oauthAuthorization.status == 'active' &&
  oauthAuthorization.oauthApplication.status == 'active' &&
  oauthAuthorization.oauthInstallation.status == 'active' &&
  oauthAuthorization.machineAccess.status == 'active' &&
  (!oauthAuthorization.organizationMember ||
    oauthAuthorization.organizationMember.status == 'active');

let isTokenCompletelyExpired = (oauthToken: OAuthToken) =>
  !!oauthToken.completelyExpiresAt && oauthToken.completelyExpiresAt < new Date();

let invalidGrantError = (message: string) =>
  new ServiceError(
    badRequestError({
      message,
      oauth: { error: 'invalid_grant', errorMessage: message }
    })
  );

export let ensureAuthorizationUsable = (oauthAuthorization: GuardedOAuthAuthorization) => {
  if (!isAuthorizationActive(oauthAuthorization)) {
    throw new ServiceError(
      unauthorizedError({
        message: 'OAuth authorization is revoked or inactive'
      })
    );
  }
};

export let ensureAuthorizationGrantable = (oauthAuthorization: GuardedOAuthAuthorization) => {
  if (!isAuthorizationActive(oauthAuthorization)) {
    throw invalidGrantError('OAuth authorization is revoked or inactive');
  }
};

export let ensureTokenRefreshable = (oauthToken: GuardedOAuthToken) => {
  ensureAuthorizationGrantable(oauthToken.oauthAuthorization);

  if (isTokenCompletelyExpired(oauthToken)) {
    throw invalidGrantError('OAuth token can no longer be refreshed or used');
  }
};

export let ensureTokenUsable = (oauthToken: GuardedOAuthToken) => {
  ensureAuthorizationUsable(oauthToken.oauthAuthorization);

  if (isTokenCompletelyExpired(oauthToken)) {
    throw new ServiceError(
      unauthorizedError({
        message: 'OAuth token can no longer be refreshed or used'
      })
    );
  }

  if (oauthToken.accessTokenExpiresAt < new Date()) {
    throw new ServiceError(
      unauthorizedError({
        message: 'OAuth access token has expired'
      })
    );
  }
};
