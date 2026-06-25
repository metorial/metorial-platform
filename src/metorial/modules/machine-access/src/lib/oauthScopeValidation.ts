import { badRequestError, ServiceError } from '@lowerdeck/error';
import { coreScopes } from '../../../access/src/definitions';
import { normalizeScopes } from './oauthAuthorizationScopes';

let oauthScopeSet = new Set(coreScopes);

export let validateOAuthScopes = (scopes: string[]) => {
  let normalizedScopes = normalizeScopes(scopes);
  let invalidScopes = normalizedScopes.filter(scope => !oauthScopeSet.has(scope as any));

  if (invalidScopes.length > 0) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid oauth scopes: ${invalidScopes.join(', ')}`
      })
    );
  }

  return normalizedScopes;
};
