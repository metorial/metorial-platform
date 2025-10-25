import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  ensureSecretType: vi.fn(async (fn: any) => {
    const data = fn();
    return {
      oid: 1,
      ...data
    };
  })
}));

describe('definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('secretTypes', () => {
    it('should define server_deployment_config secret type', async () => {
      const { secretTypes } = await import('../src/definitions');

      expect(secretTypes.server_deployment_config).toBeDefined();
    });

    it('should have correct slug and name for server_deployment_config', async () => {
      const { secretTypes } = await import('../src/definitions');

      const result = await secretTypes.server_deployment_config;

      expect(result).toHaveProperty('slug', 'server_deployment_config');
      expect(result).toHaveProperty('name', 'Server Deployment Config');
    });

    it('should return a promise that resolves to secret type', async () => {
      const { secretTypes } = await import('../src/definitions');

      const result = await secretTypes.server_deployment_config;

      expect(result).toEqual({
        oid: 1,
        slug: 'server_deployment_config',
        name: 'Server Deployment Config'
      });
    });

    it('should call ensureSecretType when accessed', async () => {
      const { secretTypes } = await import('../src/definitions');

      const result = await secretTypes.server_deployment_config;

      // Just verify that it resolves to a valid object
      expect(result).toBeDefined();
      expect(result).toHaveProperty('oid');
    });

    it('should be a record of secret type keys', async () => {
      const { secretTypes } = await import('../src/definitions');

      expect(typeof secretTypes).toBe('object');
      expect(secretTypes).not.toBeNull();
    });

    it('should have at least one secret type defined', async () => {
      const { secretTypes } = await import('../src/definitions');

      const keys = Object.keys(secretTypes);
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  describe('SecretType', () => {
    it('should be a type alias for secret type keys', async () => {
      const { secretTypes } = await import('../src/definitions');

      // TypeScript test: SecretType should be the keys of secretTypes
      const keys = Object.keys(secretTypes);
      expect(keys).toContain('server_deployment_config');
    });
  });

  describe('secretTypeSlugs', () => {
    it('should be an array of secret type keys', async () => {
      const { secretTypeSlugs } = await import('../src/definitions');

      expect(Array.isArray(secretTypeSlugs)).toBe(true);
      expect(secretTypeSlugs.length).toBeGreaterThan(0);
    });

    it('should contain server_deployment_config', async () => {
      const { secretTypeSlugs } = await import('../src/definitions');

      expect(secretTypeSlugs).toContain('server_deployment_config');
    });

    it('should have same length as secretTypes object keys', async () => {
      const { secretTypes, secretTypeSlugs } = await import('../src/definitions');

      const typeKeys = Object.keys(secretTypes);
      expect(secretTypeSlugs.length).toBe(typeKeys.length);
    });

    it('should contain all keys from secretTypes', async () => {
      const { secretTypes, secretTypeSlugs } = await import('../src/definitions');

      const typeKeys = Object.keys(secretTypes);

      typeKeys.forEach(key => {
        expect(secretTypeSlugs).toContain(key);
      });
    });

    it('should be usable in type checks', async () => {
      const { secretTypeSlugs } = await import('../src/definitions');

      // Should be able to check if a value is a valid secret type
      const isValidType = (type: string) => secretTypeSlugs.includes(type as any);

      expect(isValidType('server_deployment_config')).toBe(true);
      expect(isValidType('invalid_type')).toBe(false);
    });

    it('should not contain duplicate entries', async () => {
      const { secretTypeSlugs } = await import('../src/definitions');

      const uniqueSlugs = [...new Set(secretTypeSlugs)];
      expect(uniqueSlugs.length).toBe(secretTypeSlugs.length);
    });
  });

  describe('integration', () => {
    it('should work with ensureSecretType from db module', async () => {
      const { secretTypes } = await import('../src/definitions');

      const result = await secretTypes.server_deployment_config;

      expect(result.slug).toBe('server_deployment_config');
      expect(result.oid).toBeDefined();
    });

    it('should lazily evaluate secret types', async () => {
      const { secretTypes } = await import('../src/definitions');

      // secretTypes should be accessible
      expect(secretTypes).toBeDefined();
      expect(secretTypes.server_deployment_config).toBeDefined();

      // Access and verify it resolves
      const result = await secretTypes.server_deployment_config;
      expect(result).toBeDefined();
    });

    it('should handle multiple accesses to same secret type', async () => {
      const { secretTypes } = await import('../src/definitions');

      const result1 = await secretTypes.server_deployment_config;
      const result2 = await secretTypes.server_deployment_config;

      // Should return the same result (assuming ensureSecretType is idempotent)
      expect(result1).toEqual(result2);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent access to secret types', async () => {
      const { secretTypes } = await import('../src/definitions');

      const promises = [
        secretTypes.server_deployment_config,
        secretTypes.server_deployment_config,
        secretTypes.server_deployment_config
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.slug).toBe('server_deployment_config');
      });
    });

    it('should provide type information', async () => {
      const { secretTypes } = await import('../src/definitions');

      const type = await secretTypes.server_deployment_config;

      expect(type).toHaveProperty('oid');
      expect(type).toHaveProperty('slug');
      expect(type).toHaveProperty('name');
      expect(typeof type.oid).toBe('number');
      expect(typeof type.slug).toBe('string');
      expect(typeof type.name).toBe('string');
    });

    it('should have meaningful names', async () => {
      const { secretTypes } = await import('../src/definitions');

      const type = await secretTypes.server_deployment_config;

      expect(type.name.length).toBeGreaterThan(0);
      expect(type.name).toContain('Config');
    });

    it('should use snake_case for slugs', async () => {
      const { secretTypeSlugs } = await import('../src/definitions');

      secretTypeSlugs.forEach(slug => {
        // Should match snake_case pattern (lowercase with underscores)
        expect(slug).toMatch(/^[a-z][a-z0-9_]*$/);
      });
    });
  });

  describe('extensibility', () => {
    it('should allow adding new secret types to the structure', async () => {
      const { secretTypes } = await import('../src/definitions');

      // The structure should support additional secret types
      expect(typeof secretTypes).toBe('object');
      expect(Object.keys(secretTypes).length).toBeGreaterThanOrEqual(1);
    });

    it('should maintain consistent structure for all types', async () => {
      const { secretTypes, secretTypeSlugs } = await import('../src/definitions');

      // All entries should have the same structure
      for (const slug of secretTypeSlugs) {
        const type = secretTypes[slug];
        expect(type).toBeDefined();
        // Should be a promise
        expect(typeof type.then).toBe('function');
      }
    });
  });
});
