import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { coreScopes, Scope } from '@metorial/module-access';

let adminOnlyScopes: Scope[] = [
  'organization:write',
  'organization.invite:read',
  'organization.invite:write',
  'organization.member:write',
  'organization.team:write',
  'organization.audit_log_stream:write',
  'organization.api_key:write',
  'organization.api_key:reveal',
  'organization.access_role:write',
  'organization.access_policy:write',
  'organization.oauth_app:write',
  'organization.oauth_installation:write',
  'organization.oauth_authorization:write'
];

export let everyoneScopes: Scope[] = coreScopes.filter(
  scope =>
    !scope.startsWith('user:') &&
    !adminOnlyScopes.includes(scope) &&
    !scope.startsWith('consumer#')
) as Scope[];

export let adminScopes = [...new Set([...everyoneScopes, ...adminOnlyScopes])];

export let defaultEveryoneScopesHash = await Hash.sha256(canonicalize(everyoneScopes.sort()));
export let defaultAdminScopesHash = await Hash.sha256(canonicalize(adminScopes.sort()));
