import { badRequestError, ServiceError } from '@lowerdeck/error';
import { OAuthSubjectType } from '@metorial/db';
import { coreScopes } from '../../../access/src/definitions';
import { consumerOAuthScopes, normalizeScopes } from './oauthAuthorizationScopes';

let oauthScopeSet = new Set<string>(coreScopes);
let consumerOAuthScopeSet = new Set<string>(consumerOAuthScopes);

export let validateOAuthScopes = (
  scopes: string[],
  subjectType: OAuthSubjectType = 'organization_member'
) => {
  let allowedScopes = subjectType == 'consumer' ? consumerOAuthScopeSet : oauthScopeSet;

  let normalizedScopes = normalizeScopes(scopes);
  let invalidScopes = normalizedScopes.filter(scope => !allowedScopes.has(scope));

  if (invalidScopes.length > 0) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid oauth scopes: ${invalidScopes.join(', ')}`
      })
    );
  }

  return normalizedScopes;
};
