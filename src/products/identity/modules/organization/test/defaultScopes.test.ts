import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-access', () => import('../../access/src/definitions/scopeValues'));

import { adminScopes, everyoneScopes } from '../src/definitions/defaultScopes';

let sensitiveScopes = [
  'organization:write',
  'organization.member:write',
  'organization.project:write',
  'organization.project:manage',
  'organization.instance:write',
  'organization.outpost:write',
  'organization.api_key:write',
  'organization.api_key:reveal',
  'organization.access_role:write',
  'organization.access_policy:write',
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
] as const;

describe('default scopes', () => {
  it('does not grant sensitive scopes to everyone', () => {
    for (let scope of sensitiveScopes) {
      expect(everyoneScopes).not.toContain(scope);
    }
  });

  it('grants sensitive scopes to admins', () => {
    for (let scope of sensitiveScopes) {
      expect(adminScopes).toContain(scope);
    }
  });

  it('keeps ordinary work scopes available to everyone', () => {
    expect(everyoneScopes).toContain('organization.project:read');
    expect(everyoneScopes).toContain('instance.monitor:write');
    expect(everyoneScopes).toContain('instance.monitor:read');
  });

  it('never grants user or consumer scopes through organization policies', () => {
    for (let scope of adminScopes) {
      expect(scope.startsWith('user:')).toBe(false);
      expect(scope.startsWith('consumer#')).toBe(false);
    }
  });
});
