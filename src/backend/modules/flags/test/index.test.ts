import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies that require environment variables
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn(() => ({}))
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: vi.fn(() => factory())
    }))
  }
}));

import {
  defaultFlags,
  FlagProviderParams,
  Flags,
  getFlags,
  setFlagProvider
} from '../src/definitions';
import * as flagsModule from '../src/index';
import { flagService } from '../src/services';

describe('index module exports', () => {
  beforeEach(() => {
    // Reset flag provider to default before each test
    setFlagProvider(async () => defaultFlags);
  });

  describe('definitions exports', () => {
    it('should export defaultFlags', () => {
      expect(flagsModule.defaultFlags).toBeDefined();
      expect(flagsModule.defaultFlags).toEqual(defaultFlags);
    });

    it('should export setFlagProvider', () => {
      expect(flagsModule.setFlagProvider).toBeDefined();
      expect(typeof flagsModule.setFlagProvider).toBe('function');
      expect(flagsModule.setFlagProvider).toBe(setFlagProvider);
    });

    it('should export getFlags', () => {
      expect(flagsModule.getFlags).toBeDefined();
      expect(typeof flagsModule.getFlags).toBe('function');
      expect(flagsModule.getFlags).toBe(getFlags);
    });

    it('should export Flags type', () => {
      // Type check - if this compiles, the type is exported
      const testFlags: flagsModule.Flags = {
        'test-flag': false,
        'metorial-gateway-enabled': true,
        'custom-servers-remote-enabled': true,
        'provider-oauth-enabled': true,
        'managed-servers-enabled': false,
        'community-profiles-enabled': false,
        'magic-mcp-enabled': false,
        'paid-oauth-takeout': true
      };
      expect(testFlags).toBeDefined();
    });

    it('should export FlagProviderParams type', () => {
      // Type check - if this compiles, the type is exported
      const testParams: flagsModule.FlagProviderParams = {
        organization: { id: 'test' } as any
      };
      expect(testParams).toBeDefined();
    });
  });

  describe('services exports', () => {
    it('should export flagService', () => {
      expect(flagsModule.flagService).toBeDefined();
      expect(flagsModule.flagService).toBe(flagService);
    });

    it('should have flagService with getFlags method', () => {
      expect(flagsModule.flagService.getFlags).toBeDefined();
      expect(typeof flagsModule.flagService.getFlags).toBe('function');
    });
  });

  describe('eventQueueProcessor', () => {
    it('should export eventQueueProcessor', () => {
      expect(flagsModule.eventQueueProcessor).toBeDefined();
    });

    it('should be defined as an object', () => {
      expect(typeof flagsModule.eventQueueProcessor).toBe('object');
      expect(flagsModule.eventQueueProcessor).not.toBeNull();
    });
  });

  describe('module functionality', () => {
    it('should allow using exported functions', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any
      };

      const flags = await flagsModule.getFlags(mockParams);
      expect(flags).toBeDefined();
      expect(typeof flags).toBe('object');
    });

    it('should allow setting custom provider through exported function', async () => {
      const customFlags: Flags = {
        ...defaultFlags,
        'test-flag': true
      };

      flagsModule.setFlagProvider(async () => customFlags);

      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any
      };

      const flags = await flagsModule.getFlags(mockParams);
      expect(flags['test-flag']).toBe(true);

      // Reset to default
      flagsModule.setFlagProvider(async () => defaultFlags);
    });

    it('should maintain consistency between direct imports and module imports', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any
      };

      const flagsFromModule = await flagsModule.getFlags(mockParams);
      const flagsFromDirect = await getFlags(mockParams);

      expect(flagsFromModule).toEqual(flagsFromDirect);
    });

    it('should allow using flagService from module exports', async () => {
      const mockParams: FlagProviderParams = {
        organization: { id: 'org-1' } as any
      };

      const flags = await flagsModule.flagService.getFlags(mockParams);
      expect(flags).toBeDefined();
      expect(flags).toEqual(defaultFlags);
    });
  });

  describe('type compatibility', () => {
    it('should accept valid Flags object', () => {
      const validFlags: flagsModule.Flags = {
        'test-flag': true,
        'metorial-gateway-enabled': false,
        'custom-servers-remote-enabled': true,
        'provider-oauth-enabled': false,
        'managed-servers-enabled': true,
        'community-profiles-enabled': true,
        'magic-mcp-enabled': true,
        'paid-oauth-takeout': false
      };

      expect(Object.keys(validFlags)).toHaveLength(8);
      Object.values(validFlags).forEach(value => {
        expect(typeof value).toBe('boolean');
      });
    });

    it('should accept valid FlagProviderParams with only organization', () => {
      const validParams: flagsModule.FlagProviderParams = {
        organization: { id: 'org-1' } as any
      };

      expect(validParams.organization).toBeDefined();
      expect(validParams.user).toBeUndefined();
      expect(validParams.machineAccess).toBeUndefined();
    });

    it('should accept valid FlagProviderParams with all fields', () => {
      const validParams: flagsModule.FlagProviderParams = {
        organization: { id: 'org-1' } as any,
        user: { id: 'user-1' } as any,
        machineAccess: { id: 'machine-1' } as any
      };

      expect(validParams.organization).toBeDefined();
      expect(validParams.user).toBeDefined();
      expect(validParams.machineAccess).toBeDefined();
    });
  });

  describe('complete module interface', () => {
    it('should export all expected members', () => {
      const expectedExports = [
        'defaultFlags',
        'setFlagProvider',
        'getFlags',
        'flagService',
        'eventQueueProcessor'
      ];

      expectedExports.forEach(exportName => {
        expect(flagsModule).toHaveProperty(exportName);
      });
    });

    it('should not have unexpected exports', () => {
      const actualExports = Object.keys(flagsModule);
      const expectedExports = [
        'defaultFlags',
        'setFlagProvider',
        'getFlags',
        'flagService',
        'eventQueueProcessor'
      ];

      // All actual exports should be expected
      actualExports.forEach(exportName => {
        expect(expectedExports).toContain(exportName);
      });
    });
  });
});
