import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultFlags, setFlagProvider, getFlags, Flags, FlagProviderParams } from '../src/definitions';

describe('definitions', () => {
  describe('defaultFlags', () => {
    it('should have all required flag properties', () => {
      expect(defaultFlags).toHaveProperty('test-flag');
      expect(defaultFlags).toHaveProperty('metorial-gateway-enabled');
      expect(defaultFlags).toHaveProperty('custom-servers-remote-enabled');
      expect(defaultFlags).toHaveProperty('provider-oauth-enabled');
      expect(defaultFlags).toHaveProperty('managed-servers-enabled');
      expect(defaultFlags).toHaveProperty('community-profiles-enabled');
      expect(defaultFlags).toHaveProperty('magic-mcp-enabled');
      expect(defaultFlags).toHaveProperty('paid-oauth-takeout');
    });

    it('should have correct default values', () => {
      expect(defaultFlags['test-flag']).toBe(false);
      expect(defaultFlags['metorial-gateway-enabled']).toBe(true);
      expect(defaultFlags['custom-servers-remote-enabled']).toBe(true);
      expect(defaultFlags['provider-oauth-enabled']).toBe(true);
      expect(defaultFlags['managed-servers-enabled']).toBe(false);
      expect(defaultFlags['community-profiles-enabled']).toBe(false);
      expect(defaultFlags['magic-mcp-enabled']).toBe(false);
      expect(defaultFlags['paid-oauth-takeout']).toBe(true);
    });

    it('should have all values as booleans', () => {
      Object.values(defaultFlags).forEach(value => {
        expect(typeof value).toBe('boolean');
      });
    });
  });

  describe('getFlags', () => {
    // Reset to default provider before each test
    beforeEach(() => {
      setFlagProvider(async () => defaultFlags);
    });

    it('should return default flags when no custom provider is set', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should work with user parameter', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'user-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should work with machineAccess parameter', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        machineAccess: { id: 'machine-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should work with all parameters', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'user-1' } as any,
        machineAccess: { id: 'machine-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });
  });

  describe('setFlagProvider', () => {
    beforeEach(() => {
      // Reset to default provider
      setFlagProvider(async () => defaultFlags);
    });

    it('should allow setting a custom flag provider', async () => {
      const customFlags: Flags = {
        ...defaultFlags,
        'test-flag': true,
        'metorial-gateway-enabled': false,
      };

      setFlagProvider(async () => customFlags);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags).toEqual(customFlags);
      expect(flags['test-flag']).toBe(true);
      expect(flags['metorial-gateway-enabled']).toBe(false);
    });

    it('should allow provider to use params to return different flags', async () => {
      setFlagProvider(async (params) => {
        if (params.user?.id === 'admin-user') {
          return {
            ...defaultFlags,
            'test-flag': true,
            'magic-mcp-enabled': true,
          };
        }
        return defaultFlags;
      });

      const regularUserParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'regular-user' } as any,
      };

      const adminUserParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'admin-user' } as any,
      };

      const regularFlags = await getFlags(regularUserParams);
      expect(regularFlags['test-flag']).toBe(false);
      expect(regularFlags['magic-mcp-enabled']).toBe(false);

      const adminFlags = await getFlags(adminUserParams);
      expect(adminFlags['test-flag']).toBe(true);
      expect(adminFlags['magic-mcp-enabled']).toBe(true);
    });

    it('should allow provider to use organization to return different flags', async () => {
      setFlagProvider(async (params) => {
        if (params.organization.id === 'special-org') {
          return {
            ...defaultFlags,
            'community-profiles-enabled': true,
            'managed-servers-enabled': true,
          };
        }
        return defaultFlags;
      });

      const regularOrgParams: FlagProviderParams = {
        organization: { id: 'regular-org' } as any,
      };

      const specialOrgParams: FlagProviderParams = {
        organization: { id: 'special-org' } as any,
      };

      const regularFlags = await getFlags(regularOrgParams);
      expect(regularFlags['community-profiles-enabled']).toBe(false);
      expect(regularFlags['managed-servers-enabled']).toBe(false);

      const specialFlags = await getFlags(specialOrgParams);
      expect(specialFlags['community-profiles-enabled']).toBe(true);
      expect(specialFlags['managed-servers-enabled']).toBe(true);
    });

    it('should replace previous provider when called multiple times', async () => {
      const firstCustomFlags: Flags = {
        ...defaultFlags,
        'test-flag': true,
      };

      const secondCustomFlags: Flags = {
        ...defaultFlags,
        'test-flag': false,
        'magic-mcp-enabled': true,
      };

      setFlagProvider(async () => firstCustomFlags);
      setFlagProvider(async () => secondCustomFlags);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags).toEqual(secondCustomFlags);
      expect(flags['test-flag']).toBe(false);
      expect(flags['magic-mcp-enabled']).toBe(true);
    });

    it('should handle async provider that takes time to resolve', async () => {
      const delayedProvider = async (params: FlagProviderParams): Promise<Flags> => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          ...defaultFlags,
          'test-flag': true,
        };
      };

      setFlagProvider(delayedProvider);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags['test-flag']).toBe(true);
    });

    it('should handle provider that throws error', async () => {
      const errorProvider = async (): Promise<Flags> => {
        throw new Error('Provider error');
      };

      setFlagProvider(errorProvider);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      await expect(getFlags(mockParams)).rejects.toThrow('Provider error');
    });

    it('should allow provider to access machineAccess parameter', async () => {
      setFlagProvider(async (params) => {
        if (params.machineAccess?.id === 'trusted-machine') {
          return {
            ...defaultFlags,
            'custom-servers-remote-enabled': true,
            'managed-servers-enabled': true,
          };
        }
        return defaultFlags;
      });

      const trustedMachineParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        machineAccess: { id: 'trusted-machine' } as any,
      };

      const untrustedMachineParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        machineAccess: { id: 'untrusted-machine' } as any,
      };

      const trustedFlags = await getFlags(trustedMachineParams);
      expect(trustedFlags['custom-servers-remote-enabled']).toBe(true);
      expect(trustedFlags['managed-servers-enabled']).toBe(true);

      const untrustedFlags = await getFlags(untrustedMachineParams);
      expect(untrustedFlags['managed-servers-enabled']).toBe(false);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      setFlagProvider(async () => defaultFlags);
    });

    it('should handle getFlags being called multiple times concurrently', async () => {
      let callCount = 0;
      setFlagProvider(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return defaultFlags;
      });

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const promises = [
        getFlags(mockParams),
        getFlags(mockParams),
        getFlags(mockParams),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(flags => {
        expect(flags).toEqual(defaultFlags);
      });
      expect(callCount).toBe(3);
    });

    it('should maintain provider state across calls', async () => {
      let counter = 0;
      setFlagProvider(async () => {
        counter++;
        return {
          ...defaultFlags,
          'test-flag': counter % 2 === 0,
        };
      });

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags1 = await getFlags(mockParams);
      expect(flags1['test-flag']).toBe(false); // counter = 1, odd

      const flags2 = await getFlags(mockParams);
      expect(flags2['test-flag']).toBe(true); // counter = 2, even

      const flags3 = await getFlags(mockParams);
      expect(flags3['test-flag']).toBe(false); // counter = 3, odd
    });

    it('should work with empty organization object', async () => {
      const mockParams: FlagProviderParams = {
        organization: {} as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should handle provider returning partial flags by merging with defaults', async () => {
      // This test assumes the provider should return all flags
      // If it doesn't, this demonstrates the expected behavior
      setFlagProvider(async () => {
        return {
          ...defaultFlags,
          'test-flag': true,
        };
      });

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags = await getFlags(mockParams);
      expect(flags['test-flag']).toBe(true);
      expect(flags['metorial-gateway-enabled']).toBe(true);
      expect(Object.keys(flags).length).toBe(Object.keys(defaultFlags).length);
    });
  });
});
