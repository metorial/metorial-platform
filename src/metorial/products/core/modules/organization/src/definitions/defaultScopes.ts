import { base62 } from '@lowerdeck/base62';
import { canonicalize } from '@lowerdeck/canonicalize';
import { coreScopes, Scope } from '@metorial/module-access';
import { createHash } from 'node:crypto';

let adminOnlyScopes: Scope[] = [
  'organization:write',
  'organization.invite:read',
  'organization.invite:write',
  'organization.member:write',
  'organization.project:write',
  'organization.project:manage',
  'organization.team:write',
  'organization.instance:write',
  'organization.outpost:write',
  'organization.audit_log_stream:write',
  'organization.event_destination:write',
  'organization.event_delivery:write',
  'organization.api_key:write',
  'organization.api_key:reveal',
  'organization.access_role:write',
  'organization.access_policy:write',
  'organization.oauth_app:write',
  'organization.oauth_installation:write',
  'organization.oauth_authorization:write',

  'instance.network:write',
  'instance.monitor:manage',
  'instance.portal:write',
  'instance.portal.auth:write',
  'instance.ssoTenant:write',
  'instance.provider.public_mcp_server:write',
  'instance.provider.auth:export',
  'instance.provider.auth:import',
  'instance.provider_oauth.takeout:read',
  'instance.provider_oauth.takeout:write',
  'instance.provider_oauth.takeIn:read',
  'instance.provider_oauth.takeIn:write'
];

export let everyoneScopes: Scope[] = coreScopes.filter(
  scope =>
    !scope.startsWith('user:') &&
    !adminOnlyScopes.includes(scope) &&
    !scope.startsWith('consumer#')
) as Scope[];

export let adminScopes = [...new Set([...everyoneScopes, ...adminOnlyScopes])];

let sha256 = (data: string) =>
  base62.encode(new Uint8Array(createHash('sha256').update(data).digest()));

export let defaultEveryoneScopesHash = sha256(canonicalize(everyoneScopes.sort()));
export let defaultAdminScopesHash = sha256(canonicalize(adminScopes.sort()));
