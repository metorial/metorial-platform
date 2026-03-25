import {
  OAuthApplication,
  Organization,
  OrganizationMember,
  ServiceAccount
} from '@metorial/db';
import { effectiveAccessService } from '@metorial/module-organization';

export let normalizeScopes = (scopes: string[]) => Array.from(new Set(scopes)).sort();

export let intersectScopes = (...scopeSets: Array<string[] | undefined | null>) => {
  let normalizedSets = scopeSets
    .filter((scopeSet): scopeSet is string[] => !!scopeSet)
    .map(scopeSet => normalizeScopes(scopeSet));

  if (normalizedSets.length == 0) return [];

  return normalizedSets[0].filter(scope =>
    normalizedSets.every(scopeSet => scopeSet.includes(scope))
  );
};

export let getUserEffectiveScopes = async (d: {
  organization: Organization;
  member: OrganizationMember;
  oauthApplication: OAuthApplication;
  requestedScopes: string[];
}) => {
  if (d.organization.authVersion != 'v2') {
    return intersectScopes(d.oauthApplication.scopes, d.requestedScopes);
  }

  let effectiveAccess = await effectiveAccessService.getMemberEffectiveAccess({
    organization: d.organization,
    member: d.member
  });
  let memberScopes = normalizeScopes(
    effectiveAccessService.getGrantedScopes({
      effectiveAccess
    })
  );

  return intersectScopes(memberScopes, d.oauthApplication.scopes, d.requestedScopes);
};

export let getServiceAccountEffectiveScopes = async (d: {
  organization: Organization;
  serviceAccount: Pick<ServiceAccount, 'oid' | 'scopes'>;
  oauthApplication: OAuthApplication;
  requestedScopes: string[];
}) => {
  if (d.organization.authVersion != 'v2') {
    return intersectScopes(
      d.serviceAccount.scopes,
      d.oauthApplication.scopes,
      d.requestedScopes
    );
  }

  let effectiveAccess = await effectiveAccessService.getServiceAccountEffectiveAccess({
    organization: d.organization,
    serviceAccount: d.serviceAccount
  });
  let policyScopes = normalizeScopes(
    effectiveAccessService.getGrantedScopes({
      effectiveAccess
    })
  );

  return intersectScopes(
    d.serviceAccount.scopes,
    policyScopes,
    d.oauthApplication.scopes,
    d.requestedScopes
  );
};
