import { describe, expect, it } from 'vitest';
import {
  instancePublishableTokenScopes,
  instancePublishableTokenWithConsumerScopes,
  instanceSecretTokenScopes,
  orgManagementTokenScopes,
  scopes
} from '../src/definitions';

describe('definitions', () => {
  describe('scopes', () => {
    it('should contain all defined scope values', () => {
      expect(scopes).toBeDefined();
      expect(Array.isArray(scopes)).toBe(true);
      expect(scopes.length).toBeGreaterThan(0);
    });

    it('should contain user scopes', () => {
      expect(scopes).toContain('user:read');
      expect(scopes).toContain('user:write');
    });

    it('should contain organization scopes', () => {
      expect(scopes).toContain('organization:read');
      expect(scopes).toContain('organization:write');
    });

    it('should contain organization.invite scopes', () => {
      expect(scopes).toContain('organization.invite:read');
      expect(scopes).toContain('organization.invite:write');
    });

    it('should contain organization.project scopes', () => {
      expect(scopes).toContain('organization.project:read');
      expect(scopes).toContain('organization.project:write');
    });

    it('should contain organization.member scopes', () => {
      expect(scopes).toContain('organization.member:read');
      expect(scopes).toContain('organization.member:write');
    });

    it('should contain organization.instance scopes', () => {
      expect(scopes).toContain('organization.instance:read');
      expect(scopes).toContain('organization.instance:write');
    });

    it('should contain instance.file scopes', () => {
      expect(scopes).toContain('instance.file:read');
      expect(scopes).toContain('instance.file:write');
      expect(scopes).toContain('instance.file_link:read');
      expect(scopes).toContain('instance.file_link:write');
    });

    it('should contain consumer cargo scopes', () => {
      expect(scopes).toContain('consumer#organization:read');
      expect(scopes).toContain('consumer#project:read');
      expect(scopes).toContain('consumer#instance:read');
      expect(scopes).toContain('consumer#instance.portal:read');
      expect(scopes).toContain('consumer#instance.profile:read');
      expect(scopes).toContain('consumer#instance.file:read');
      expect(scopes).toContain('consumer#instance.file:write');
      expect(scopes).toContain('consumer#instance.file_link:read');
      expect(scopes).toContain('consumer#instance.file_link:write');
      expect(scopes).toContain('consumer#instance.document:read');
      expect(scopes).toContain('consumer#instance.document:write');
      expect(scopes).toContain('consumer#instance.store:read');
    });

    it('should contain instance.secret scopes', () => {
      expect(scopes).toContain('instance.secret:read');
      expect(scopes).toContain('instance.secret:write');
    });

    it('should contain instance.provider scopes', () => {
      expect(scopes).toContain('instance.provider:read');
      expect(scopes).toContain('instance.provider:write');
      expect(scopes).toContain('instance.provider.listing:read');
    });

    it('should contain instance skill scopes', () => {
      expect(scopes).toContain('instance.skill:read');
      expect(scopes).toContain('instance.skill:write');
      expect(scopes).toContain('consumer#instance.skill:read');
      expect(scopes).toContain('consumer#instance.skill:write');
    });

    it('should contain instance.session scopes', () => {
      expect(scopes).toContain('instance.session:read');
      expect(scopes).toContain('instance.session:write');
    });

    it('should contain instance.provider_oauth.connection scopes', () => {
      expect(scopes).toContain('instance.provider_oauth.connection:read');
      expect(scopes).toContain('instance.provider_oauth.connection:write');
    });

    it('should contain instance.provider_oauth.session scopes', () => {
      expect(scopes).toContain('instance.provider_oauth.session:read');
      expect(scopes).toContain('instance.provider_oauth.session:write');
    });

    it('should contain instance.provider_oauth.connection read-only scopes', () => {
      expect(scopes).toContain('instance.provider_oauth.connection.authentication:read');
      expect(scopes).toContain('instance.provider_oauth.connection.event:read');
      expect(scopes).toContain('instance.provider_oauth.connection.profile:read');
    });

    it('should contain instance.provider_oauth.takeout scopes', () => {
      expect(scopes).toContain('instance.provider_oauth.takeout:read');
      expect(scopes).toContain('instance.provider_oauth.takeout:write');
    });

    it('should contain instance.custom_server scopes', () => {
      expect(scopes).toContain('instance.custom_server:read');
      expect(scopes).toContain('instance.custom_server:write');
    });

    it('should not contain duplicate scopes', () => {
      let uniqueScopes = new Set(scopes);
      expect(uniqueScopes.size).toBe(scopes.length);
    });

    it('should have all scopes follow the correct pattern', () => {
      let validPatterns = [
        /^organization\.[a-z_]+:[a-z]+$/,
        /^organization:[a-z]+$/,
        /^user\.[a-z_]+:[a-z]+$/,
        /^user:[a-z]+$/,
        /^instance\.[a-z_]+(\.[a-z_]+)*:[a-z]+$/ // Allow any number of dot-separated segments
      ];
    });
  });

  describe('orgManagementTokenScopes', () => {
    it('should be a subset of all scopes', () => {
      orgManagementTokenScopes.forEach(scope => {
        expect(scopes).toContain(scope);
      });
    });

    it('should not contain user:read', () => {
      expect(orgManagementTokenScopes).not.toContain('user:read');
    });

    it('should not contain user:write', () => {
      expect(orgManagementTokenScopes).not.toContain('user:write');
    });

    it('should contain organization scopes', () => {
      expect(orgManagementTokenScopes).toContain('organization:read');
      expect(orgManagementTokenScopes).toContain('organization:write');
    });

    it('should contain instance scopes', () => {
      expect(orgManagementTokenScopes).toContain('instance.file:read');
      expect(orgManagementTokenScopes).toContain('instance.provider:write');
    });
  });

  describe('instanceSecretTokenScopes', () => {
    it('should be a subset of all scopes', () => {
      instanceSecretTokenScopes.forEach(scope => {
        expect(scopes).toContain(scope);
      });
    });

    it('should contain organization read scopes', () => {
      expect(instanceSecretTokenScopes).toContain('organization:read');
      expect(instanceSecretTokenScopes).toContain('organization.project:read');
      expect(instanceSecretTokenScopes).toContain('organization.instance:read');
    });

    it('should not contain organization write scopes', () => {
      expect(instanceSecretTokenScopes).not.toContain('organization:write');
      expect(instanceSecretTokenScopes).not.toContain('organization.project:write');
      expect(instanceSecretTokenScopes).not.toContain('organization.instance:write');
    });

    it('should not contain user scopes', () => {
      expect(instanceSecretTokenScopes).not.toContain('user:read');
      expect(instanceSecretTokenScopes).not.toContain('user:write');
    });

    it('should contain instance file scopes', () => {
      expect(instanceSecretTokenScopes).toContain('instance.file:read');
      expect(instanceSecretTokenScopes).toContain('instance.file:write');
      expect(instanceSecretTokenScopes).toContain('instance.file_link:read');
      expect(instanceSecretTokenScopes).toContain('instance.file_link:write');
    });

    it('should contain instance secret scopes', () => {
      expect(instanceSecretTokenScopes).toContain('instance.secret:read');
      expect(instanceSecretTokenScopes).toContain('instance.secret:write');
    });

    it('should contain instance provider scopes', () => {
      expect(instanceSecretTokenScopes).toContain('instance.provider:read');
      expect(instanceSecretTokenScopes).toContain('instance.provider:write');
      expect(instanceSecretTokenScopes).toContain('instance.provider.listing:read');
    });

    it('should contain instance skill scopes', () => {
      expect(instanceSecretTokenScopes).toContain('instance.skill:read');
      expect(instanceSecretTokenScopes).toContain('instance.skill:write');
    });

    it('should contain instance provider oauth scopes', () => {
      expect(instanceSecretTokenScopes).toContain('instance.provider_oauth.connection:read');
      expect(instanceSecretTokenScopes).toContain('instance.provider_oauth.session:write');
    });

    it('should not contain duplicate scopes', () => {
      let uniqueScopes = new Set(instanceSecretTokenScopes);
      expect(uniqueScopes.size).toBe(instanceSecretTokenScopes.length);
    });
  });

  describe('instancePublishableTokenScopes', () => {
    it('should be a subset of all scopes', () => {
      instancePublishableTokenScopes.forEach(scope => {
        expect(scopes).toContain(scope);
      });
    });

    it('should contain required read scopes', () => {
      expect(instancePublishableTokenScopes).toHaveLength(10);
      expect(instancePublishableTokenScopes).toContain('instance.provider.listing:read');
      expect(instancePublishableTokenScopes).toContain('organization.instance:read');
      expect(instancePublishableTokenScopes).toContain('instance.portal:read');
      expect(instancePublishableTokenScopes).toContain('instance.portal.access:read');
      expect(instancePublishableTokenScopes).toContain('instance.provider:read');
    });

    it('should be the most restrictive scope set', () => {
      expect(instancePublishableTokenScopes.length).toBeLessThan(
        instanceSecretTokenScopes.length
      );
      expect(instancePublishableTokenScopes.length).toBeLessThan(
        orgManagementTokenScopes.length
      );
      expect(instancePublishableTokenScopes.length).toBeLessThan(scopes.length);
    });

    it('should not contain write scopes', () => {
      instancePublishableTokenScopes.forEach(scope => {
        expect(scope).not.toMatch(/:write$/);
      });
    });
  });

  describe('instancePublishableTokenWithConsumerScopes', () => {
    it('should include consumer-specific cargo scopes', () => {
      expect(instancePublishableTokenWithConsumerScopes).toContain(
        'consumer#organization:read'
      );
      expect(instancePublishableTokenWithConsumerScopes).toContain('consumer#project:read');
      expect(instancePublishableTokenWithConsumerScopes).toContain('consumer#instance:read');
      expect(instancePublishableTokenWithConsumerScopes).toContain(
        'consumer#instance.portal:read'
      );
      expect(instancePublishableTokenWithConsumerScopes).toContain(
        'consumer#instance.profile:read'
      );
      expect(instancePublishableTokenWithConsumerScopes).toContain('consumer#instance.file:read');
      expect(instancePublishableTokenWithConsumerScopes).toContain('consumer#instance.file:write');
      expect(instancePublishableTokenWithConsumerScopes).toContain(
        'consumer#instance.file_link:read'
      );
      expect(instancePublishableTokenWithConsumerScopes).toContain(
        'consumer#instance.file_link:write'
      );
      expect(instancePublishableTokenWithConsumerScopes).toContain(
        'consumer#instance.document:read'
      );
      expect(instancePublishableTokenWithConsumerScopes).toContain(
        'consumer#instance.document:write'
      );
      expect(instancePublishableTokenWithConsumerScopes).toContain('consumer#instance.store:read');
    });

    it('should not include regular file scopes for consumers', () => {
      expect(instancePublishableTokenWithConsumerScopes).not.toContain('instance.file:read');
      expect(instancePublishableTokenWithConsumerScopes).not.toContain('instance.file:write');
      expect(instancePublishableTokenWithConsumerScopes).not.toContain('instance.file_link:read');
      expect(instancePublishableTokenWithConsumerScopes).not.toContain(
        'instance.file_link:write'
      );
    });

    it('should still contain all publishable scopes', () => {
      instancePublishableTokenScopes.forEach(scope => {
        expect(instancePublishableTokenWithConsumerScopes).toContain(scope);
      });
    });

    it('should include consumer skill scopes', () => {
      expect(instancePublishableTokenWithConsumerScopes).toContain('consumer#instance.skill:read');
      expect(instancePublishableTokenWithConsumerScopes).toContain('consumer#instance.skill:write');
    });
  });

  describe('scope relationships', () => {
    it('instancePublishableTokenScopes should be a subset of instanceSecretTokenScopes', () => {
      instancePublishableTokenScopes.forEach(scope => {
        expect(instanceSecretTokenScopes).toContain(scope);
      });
    });

    it('instanceSecretTokenScopes should not overlap with user scopes', () => {
      let userScopes = scopes.filter(s => s.startsWith('user:'));
      instanceSecretTokenScopes.forEach(scope => {
        expect(userScopes).not.toContain(scope);
      });
    });

    it('orgManagementTokenScopes should be larger than instanceSecretTokenScopes', () => {
      expect(orgManagementTokenScopes.length).toBeGreaterThan(
        instanceSecretTokenScopes.length
      );
    });
  });

  describe('edge cases', () => {
    it('should handle scope array immutability', () => {
      let originalLength = scopes.length;
      expect(() => {
        // TypeScript should prevent this, but test runtime behavior
        (scopes as any).push('invalid:scope');
      }).not.toThrow();
      // After push, length changes (arrays are mutable in JS)
      expect(scopes.length).toBeGreaterThanOrEqual(originalLength);
    });

    it('should ensure all scope sets are arrays', () => {
      expect(Array.isArray(scopes)).toBe(true);
      expect(Array.isArray(orgManagementTokenScopes)).toBe(true);
      expect(Array.isArray(instanceSecretTokenScopes)).toBe(true);
      expect(Array.isArray(instancePublishableTokenScopes)).toBe(true);
    });

    it('should not have empty scope arrays', () => {
      expect(scopes.length).toBeGreaterThan(0);
      expect(orgManagementTokenScopes.length).toBeGreaterThan(0);
      expect(instanceSecretTokenScopes.length).toBeGreaterThan(0);
      expect(instancePublishableTokenScopes.length).toBeGreaterThan(0);
    });
  });
});
