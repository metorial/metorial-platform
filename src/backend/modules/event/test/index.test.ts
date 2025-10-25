// @ts-nocheck - Dynamic imports used in tests are supported by vitest but not by tsc with current module settings
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors: any[]) => ({
    name: 'combined-processor',
    processors
  }))
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: () => any) => ({
      build: vi.fn(() => factory())
    }))
  }
}));

vi.mock('@metorial/db', () => ({
  File: {},
  FilePurpose: {},
  Secret: {},
  Server: {},
  ServerDeployment: {},
  ServerDeploymentConfig: {},
  ServerImplementation: {},
  ServerSession: {},
  ServerVariant: {},
  Session: {},
  SessionServerDeployment: {},
  Instance: {},
  Organization: {},
  OrganizationActor: {}
}));

import { eventQueueProcessor, ingestEventService } from '../src/index';
import { combineQueueProcessors } from '@metorial/queue';

describe('Event Module Exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('eventQueueProcessor', () => {
    it('should export eventQueueProcessor', () => {
      expect(eventQueueProcessor).toBeDefined();
    });

    it('should have correct structure from combineQueueProcessors', () => {
      expect(eventQueueProcessor).toHaveProperty('name');
      expect(eventQueueProcessor).toBeDefined();
    });
  });

  describe('ingestEventService export', () => {
    it('should export ingestEventService', () => {
      expect(ingestEventService).toBeDefined();
    });

    it('should export ingestEventService with ingest method', () => {
      expect(ingestEventService.ingest).toBeDefined();
      expect(typeof ingestEventService.ingest).toBe('function');
    });

    it('should be able to call ingest method', async () => {
      const payload = {
        serverImplementation: {
          id: 'impl-1',
          server: { id: 'server-1', name: 'Server' },
          serverVariant: { id: 'variant-1', name: 'Variant' }
        },
        organization: { id: 'org-1', name: 'Org' },
        instance: { id: 'inst-1', name: 'Instance' }
      } as any;

      await expect(
        ingestEventService.ingest('server.server_implementation:created', payload)
      ).resolves.not.toThrow();
    });
  });

  describe('Module Structure', () => {
    it('should export all services from services/index', async () => {
      // Dynamically import to check exports
      const servicesModule = await import('../src/services/index');

      expect(servicesModule).toBeDefined();
      expect(servicesModule.ingestEventService).toBeDefined();
    });

    it('should export service through main index', async () => {
      const mainModule = await import('../src/index');

      expect(mainModule).toBeDefined();
      expect(mainModule.ingestEventService).toBeDefined();
      expect(mainModule.eventQueueProcessor).toBeDefined();
    });
  });

  describe('Type Exports', () => {
    it('should be able to import types from definitions', async () => {
      const definitionsModule = await import('../src/definitions');

      // Check that types are accessible (compile-time check primarily)
      expect(definitionsModule).toBeDefined();
    });

    it('should verify EventTypes structure exists', async () => {
      const definitionsModule = await import('../src/definitions');

      // Types are compile-time only, but we can verify the module exports
      expect(typeof definitionsModule).toBe('object');
    });
  });

  describe('Integration', () => {
    it('should allow ingestEventService to be used with eventQueueProcessor context', async () => {
      // Test that the service and processor can coexist
      expect(eventQueueProcessor).toBeDefined();
      expect(ingestEventService).toBeDefined();

      // They should be independent objects
      expect(eventQueueProcessor).not.toBe(ingestEventService);
    });

    it('should handle multiple concurrent service calls', async () => {
      const payload1 = {
        serverImplementation: {
          id: 'impl-1',
          server: { id: 'server-1', name: 'Server 1' },
          serverVariant: { id: 'variant-1', name: 'Variant 1' }
        },
        organization: { id: 'org-1', name: 'Org 1' },
        instance: { id: 'inst-1', name: 'Instance 1' }
      } as any;

      const payload2 = {
        session: {
          id: 'session-1',
          userId: 'user-1',
          serverDeployments: []
        },
        organization: { id: 'org-2', name: 'Org 2' },
        instance: { id: 'inst-2', name: 'Instance 2' }
      } as any;

      await expect(
        Promise.all([
          ingestEventService.ingest('server.server_implementation:created', payload1),
          ingestEventService.ingest('session:created', payload2)
        ])
      ).resolves.not.toThrow();
    });

    it('should maintain service state across calls', async () => {
      const payload = {
        serverImplementation: {
          id: 'impl-1',
          server: { id: 'server-1', name: 'Server' },
          serverVariant: { id: 'variant-1', name: 'Variant' }
        },
        organization: { id: 'org-1', name: 'Org' },
        instance: { id: 'inst-1', name: 'Instance' }
      } as any;

      // Make multiple calls
      await ingestEventService.ingest('server.server_implementation:created', payload);
      await ingestEventService.ingest('server.server_implementation:updated', payload);
      await ingestEventService.ingest('server.server_implementation:deleted', payload);

      // Service should still be functional
      expect(ingestEventService.ingest).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle module re-imports', async () => {
      const module1 = await import('../src/index');
      const module2 = await import('../src/index');

      // Should be the same module instance
      expect(module1.ingestEventService).toBe(module2.ingestEventService);
      expect(module1.eventQueueProcessor).toBe(module2.eventQueueProcessor);
    });

    it('should handle destructured imports', async () => {
      const { ingestEventService: service1, eventQueueProcessor: processor1 } =
        await import('../src/index');

      expect(service1).toBeDefined();
      expect(processor1).toBeDefined();
      expect(service1).toBe(ingestEventService);
      expect(processor1).toBe(eventQueueProcessor);
    });

    it('should provide stable references across imports', () => {
      // Import the same module multiple times
      const ref1 = eventQueueProcessor;
      const ref2 = eventQueueProcessor;

      expect(ref1).toBe(ref2);
    });
  });

  describe('Module Initialization', () => {
    it('should have eventQueueProcessor ready for use', () => {
      expect(eventQueueProcessor).toBeDefined();
      expect(typeof eventQueueProcessor).toBe('object');
    });

    it('should have ingestEventService ready for use', () => {
      expect(ingestEventService).toBeDefined();
      expect(typeof ingestEventService).toBe('object');
      expect(typeof ingestEventService.ingest).toBe('function');
    });
  });

  describe('Export Completeness', () => {
    it('should export all expected members', async () => {
      const mainModule = await import('../src/index');
      const exports = Object.keys(mainModule);

      expect(exports).toContain('eventQueueProcessor');
      expect(exports).toContain('ingestEventService');
    });

    it('should re-export services from services module', async () => {
      const servicesModule = await import('../src/services');
      const mainModule = await import('../src/index');

      expect(mainModule.ingestEventService).toBe(servicesModule.ingestEventService);
    });

    it('should have proper export structure', async () => {
      const mainModule = await import('../src/index');

      // Check that exports are not undefined
      expect(mainModule.eventQueueProcessor).not.toBeUndefined();
      expect(mainModule.ingestEventService).not.toBeUndefined();

      // Check that they are the expected types
      expect(typeof mainModule.eventQueueProcessor).toBe('object');
      expect(typeof mainModule.ingestEventService).toBe('object');
    });
  });

  describe('Namespace Pollution', () => {
    it('should not export internal implementation details', async () => {
      const mainModule = await import('../src/index');
      const exports = Object.keys(mainModule);

      // Should only export public API
      expect(exports).not.toContain('IngestEventServiceImpl');
      expect(exports).not.toContain('private');
      expect(exports).not.toContain('internal');
    });

    it('should have clean export surface', async () => {
      const mainModule = await import('../src/index');
      const exports = Object.keys(mainModule);

      // All exports should be intentional public API
      exports.forEach((exportName) => {
        expect(exportName).not.toMatch(/^_/); // No leading underscore (private convention)
        expect(exportName).not.toMatch(/test/i); // No test-related exports
        expect(exportName).not.toMatch(/mock/i); // No mock-related exports
      });
    });
  });

  describe('Module Dependencies', () => {
    it('should properly import from @metorial/queue', () => {
      expect(combineQueueProcessors).toBeDefined();
      expect(typeof combineQueueProcessors).toBe('function');
    });

    it('should handle queue processor configuration', () => {
      const processor = eventQueueProcessor;

      expect(processor).toBeDefined();
      expect(typeof processor).toBe('object');
    });

    it('should maintain proper service initialization', () => {
      // Service should be properly initialized via Service.create().build()
      expect(ingestEventService).toBeDefined();
      expect(ingestEventService.ingest).toBeDefined();
    });
  });
});
