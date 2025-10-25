import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flagService } from '../src/services/flags';
import { setFlagProvider, defaultFlags, FlagProviderParams, Flags } from '../src/definitions';

describe('flagService', () => {
  beforeEach(() => {
    // Reset to default provider before each test
    setFlagProvider(async () => defaultFlags);
  });

  describe('service creation', () => {
    it('should create a flag service', () => {
      expect(flagService).toBeDefined();
      expect(flagService).toHaveProperty('getFlags');
    });

    it('should have getFlags method', () => {
      expect(typeof flagService.getFlags).toBe('function');
    });
  });

  describe('getFlags method', () => {
    it('should return default flags', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags = await flagService.getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should work with user parameter', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'user-1', name: 'Test User' } as any,
      };

      const flags = await flagService.getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should work with machineAccess parameter', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        machineAccess: { id: 'machine-1' } as any,
      };

      const flags = await flagService.getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should work with all parameters provided', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1', name: 'Test Org' } as any,
        user: { id: 'user-1', name: 'Test User' } as any,
        machineAccess: { id: 'machine-1' } as any,
      };

      const flags = await flagService.getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should respect custom flag provider', async () => {
      const customFlags: Flags = {
        ...defaultFlags,
        'test-flag': true,
        'metorial-gateway-enabled': false,
        'magic-mcp-enabled': true,
      };

      setFlagProvider(async () => customFlags);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const flags = await flagService.getFlags(mockParams);
      expect(flags).toEqual(customFlags);
      expect(flags['test-flag']).toBe(true);
      expect(flags['metorial-gateway-enabled']).toBe(false);
      expect(flags['magic-mcp-enabled']).toBe(true);
    });

    it('should pass params correctly to the flag provider', async () => {
      const mockProvider = vi.fn(async (params: FlagProviderParams) => {
        if (params.organization.id === 'special-org') {
          return {
            ...defaultFlags,
            'community-profiles-enabled': true,
          };
        }
        return defaultFlags;
      });

      setFlagProvider(mockProvider);

      const mockParams: FlagProviderParams = {
        organization: { id: 'special-org' } as any,
      };

      const flags = await flagService.getFlags(mockParams);

      expect(mockProvider).toHaveBeenCalledTimes(1);
      expect(mockProvider).toHaveBeenCalledWith(mockParams);
      expect(flags['community-profiles-enabled']).toBe(true);
    });

    it('should handle provider errors gracefully', async () => {
      const errorProvider = async (): Promise<Flags> => {
        throw new Error('Flag provider error');
      };

      setFlagProvider(errorProvider);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      await expect(flagService.getFlags(mockParams)).rejects.toThrow('Flag provider error');
    });

    it('should handle async provider with delay', async () => {
      const delayedProvider = async (params: FlagProviderParams): Promise<Flags> => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          ...defaultFlags,
          'paid-oauth-takeout': false,
        };
      };

      setFlagProvider(delayedProvider);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const startTime = Date.now();
      const flags = await flagService.getFlags(mockParams);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(15);
      expect(flags['paid-oauth-takeout']).toBe(false);
    });
  });

  describe('service behavior with dynamic providers', () => {
    it('should support user-based flag variations', async () => {
      setFlagProvider(async (params) => {
        const isAdmin = params.user?.id === 'admin-123';
        return {
          ...defaultFlags,
          'magic-mcp-enabled': isAdmin,
          'managed-servers-enabled': isAdmin,
        };
      });

      const adminParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'admin-123' } as any,
      };

      const regularParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'user-456' } as any,
      };

      const adminFlags = await flagService.getFlags(adminParams);
      expect(adminFlags['magic-mcp-enabled']).toBe(true);
      expect(adminFlags['managed-servers-enabled']).toBe(true);

      const regularFlags = await flagService.getFlags(regularParams);
      expect(regularFlags['magic-mcp-enabled']).toBe(false);
      expect(regularFlags['managed-servers-enabled']).toBe(false);
    });

    it('should support organization-based flag variations', async () => {
      setFlagProvider(async (params) => {
        const isPremium = params.organization.id === 'premium-org';
        return {
          ...defaultFlags,
          'community-profiles-enabled': isPremium,
          'custom-servers-remote-enabled': isPremium,
        };
      });

      const premiumParams: FlagProviderParams = {
        organization: { id: 'premium-org' } as any,
      };

      const freeParams: FlagProviderParams = {
        organization: { id: 'free-org' } as any,
      };

      const premiumFlags = await flagService.getFlags(premiumParams);
      expect(premiumFlags['community-profiles-enabled']).toBe(true);
      expect(premiumFlags['custom-servers-remote-enabled']).toBe(true);

      const freeFlags = await flagService.getFlags(freeParams);
      expect(freeFlags['community-profiles-enabled']).toBe(false);
    });

    it('should handle concurrent calls correctly', async () => {
      let counter = 0;
      setFlagProvider(async () => {
        counter++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return defaultFlags;
      });

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      const promises = [
        flagService.getFlags(mockParams),
        flagService.getFlags(mockParams),
        flagService.getFlags(mockParams),
        flagService.getFlags(mockParams),
        flagService.getFlags(mockParams),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(flags => {
        expect(flags).toEqual(defaultFlags);
      });
      expect(counter).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty organization object', async () => {
      const mockParams: FlagProviderParams = {
        organization: {} as any,
      };

      const flags = await flagService.getFlags(mockParams);
      expect(flags).toBeDefined();
      expect(typeof flags).toBe('object');
    });

    it('should handle undefined optional parameters', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: undefined,
        machineAccess: undefined,
      };

      const flags = await flagService.getFlags(mockParams);
      expect(flags).toEqual(defaultFlags);
    });

    it('should maintain provider changes across service calls', async () => {
      const firstProvider = async (): Promise<Flags> => ({
        ...defaultFlags,
        'test-flag': true,
      });

      const secondProvider = async (): Promise<Flags> => ({
        ...defaultFlags,
        'test-flag': false,
        'magic-mcp-enabled': true,
      });

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      setFlagProvider(firstProvider);
      const flags1 = await flagService.getFlags(mockParams);
      expect(flags1['test-flag']).toBe(true);
      expect(flags1['magic-mcp-enabled']).toBe(false);

      setFlagProvider(secondProvider);
      const flags2 = await flagService.getFlags(mockParams);
      expect(flags2['test-flag']).toBe(false);
      expect(flags2['magic-mcp-enabled']).toBe(true);
    });

    it('should handle provider that returns Promise rejection', async () => {
      setFlagProvider(() => Promise.reject(new Error('Network error')));

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any,
      };

      await expect(flagService.getFlags(mockParams)).rejects.toThrow('Network error');
    });
  });
});
