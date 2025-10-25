import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ProviderOAuthConnection, ProviderOAuthConfig, Instance, Organization } from '@metorial/db';

// Mock dependencies
const mockDbFindUnique = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbUpdateMany = vi.fn();
const mockAutoRegister = vi.fn();
const mockQueueAdd = vi.fn();
const mockQueueProcess = vi.fn((handler) => handler);
const mockCreateQueue = vi.fn(() => ({
  add: mockQueueAdd,
  process: mockQueueProcess
}));

vi.mock('@metorial/db', () => ({
  db: {
    providerOAuthConnection: {
      findUnique: mockDbFindUnique,
      update: mockDbUpdate
    },
    serverDeployment: {
      updateMany: mockDbUpdateMany
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: mockCreateQueue,
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../src/services', () => ({
  providerOauthDiscoveryService: {
    autoRegisterForOauthConfig: mockAutoRegister
  }
}));

describe('queue/asyncAutoDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('asyncAutoDiscoveryQueue', () => {
    it('should create queue with correct configuration', async () => {
      await import('../src/queue/asyncAutoDiscovery');

      expect(mockCreateQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'oat/asyncadic',
          workerOpts: expect.objectContaining({
            concurrency: 10,
            limiter: { max: 25, duration: 1000 }
          }),
          jobOpts: expect.objectContaining({
            attempts: 25,
            backoff: { type: 'exponential', delay: 1000 }
          })
        })
      );
    });

    it('should export asyncAutoDiscoveryQueue', async () => {
      const module = await import('../src/queue/asyncAutoDiscovery');
      expect(module.asyncAutoDiscoveryQueue).toBeDefined();
    });

    it('should export asyncAutoDiscoveryQueueProcessor', async () => {
      const module = await import('../src/queue/asyncAutoDiscovery');
      expect(module.asyncAutoDiscoveryQueueProcessor).toBeDefined();
    });
  });

  describe('asyncAutoDiscoveryQueueProcessor', () => {
    let processorFn: any;

    beforeEach(async () => {
      vi.resetModules();
      mockQueueProcess.mockImplementation((handler) => {
        processorFn = handler;
        return handler;
      });
      await import('../src/queue/asyncAutoDiscovery');
    });

    it('should throw QueueRetryError if connection not found', async () => {
      mockDbFindUnique.mockResolvedValue(null);

      await expect(processorFn({ connectionId: 'test-id' })).rejects.toThrow();
    });

    it('should skip processing if isAutoDiscoveryActive is false', async () => {
      const mockConnection = {
        id: 'test-id',
        isAutoDiscoveryActive: false,
        config: { config: {} },
        instance: { organization: { name: 'Test Org' } }
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      await processorFn({ connectionId: 'test-id' });

      expect(mockAutoRegister).not.toHaveBeenCalled();
    });

    it('should call autoRegisterForOauthConfig with correct params', async () => {
      const mockConfig = { issuer: 'https://example.com' };
      const mockConnection = {
        id: 'test-id',
        oid: 1n,
        isAutoDiscoveryActive: true,
        clientId: 'existing-client',
        config: { config: mockConfig },
        instance: { organization: { name: 'Test Org' } }
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);
      mockAutoRegister.mockResolvedValue({ oid: 1n, clientId: 'new-client', clientSecret: 'secret' });

      await processorFn({ connectionId: 'test-id' });

      expect(mockAutoRegister).toHaveBeenCalledWith({
        config: mockConfig,
        clientName: 'Test Org'
      });
    });

    it('should update connection with successful registration', async () => {
      const mockConnection = {
        id: 'test-id',
        oid: 1n,
        isAutoDiscoveryActive: true,
        clientId: null,
        config: { config: {} },
        instance: { organization: { name: 'Test Org' } }
      };
      const mockAutoReg = {
        oid: 2n,
        clientId: 'new-client',
        clientSecret: 'new-secret'
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);
      mockAutoRegister.mockResolvedValue(mockAutoReg);

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          registrationOid: 2n,
          isAutoDiscoveryActive: false,
          status: 'active',
          failureCode: null,
          failureMessage: null,
          clientId: 'new-client',
          clientSecret: 'new-secret'
        }
      });
    });

    it('should handle failed auto registration when no clientId exists', async () => {
      const mockConnection = {
        id: 'test-id',
        oid: 1n,
        isAutoDiscoveryActive: true,
        clientId: null,
        config: { config: {} },
        instance: { organization: { name: 'Test Org' } }
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);
      mockAutoRegister.mockResolvedValue(null);

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          status: 'failed',
          isAutoDiscoveryActive: false,
          failureCode: 'auto_registration_unsupported',
          failureMessage: 'Provider does not support auto registration'
        }
      });
    });

    it('should update related server deployments on failure', async () => {
      const mockConnection = {
        id: 'test-id',
        oid: 1n,
        isAutoDiscoveryActive: true,
        clientId: null,
        config: { config: {} },
        instance: { organization: { name: 'Test Org' } }
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);
      mockAutoRegister.mockResolvedValue(null);

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpdateMany).toHaveBeenCalledWith({
        where: {
          oauthConnectionOid: 1n
        },
        data: {
          status: 'failed',
          failureCode: 'oauth_connection_setup_failed',
          failureMessage: 'OAuth connection setup failed due to provider not supporting auto registration'
        }
      });
    });

    it('should handle auto registration with existing clientId', async () => {
      const mockConnection = {
        id: 'test-id',
        oid: 1n,
        isAutoDiscoveryActive: true,
        clientId: 'existing-client',
        config: { config: {} },
        instance: { organization: { name: 'Test Org' } }
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);
      mockAutoRegister.mockResolvedValue(null);

      await processorFn({ connectionId: 'test-id' });

      // Should not mark as failed if clientId already exists
      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          registrationOid: undefined,
          isAutoDiscoveryActive: false,
          status: 'active',
          failureCode: null,
          failureMessage: null,
          clientId: undefined,
          clientSecret: undefined
        }
      });
    });

    it('should catch and suppress errors', async () => {
      mockDbFindUnique.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(processorFn({ connectionId: 'test-id' })).resolves.toBeUndefined();
    });
  });

  describe('edge cases', () => {
    let processorFn: any;

    beforeEach(async () => {
      vi.resetModules();
      mockQueueProcess.mockImplementation((handler) => {
        processorFn = handler;
        return handler;
      });
      await import('../src/queue/asyncAutoDiscovery');
    });

    it('should handle connection with undefined clientSecret in registration', async () => {
      const mockConnection = {
        id: 'test-id',
        oid: 1n,
        isAutoDiscoveryActive: true,
        clientId: null,
        config: { config: {} },
        instance: { organization: { name: 'Test Org' } }
      };
      const mockAutoReg = {
        oid: 2n,
        clientId: 'new-client',
        clientSecret: null
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);
      mockAutoRegister.mockResolvedValue(mockAutoReg);

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: expect.objectContaining({
          clientSecret: undefined
        })
      });
    });

    it('should handle empty organization name', async () => {
      const mockConnection = {
        id: 'test-id',
        oid: 1n,
        isAutoDiscoveryActive: true,
        config: { config: {} },
        instance: { organization: { name: '' } }
      };
      mockDbFindUnique.mockResolvedValue(mockConnection);
      mockAutoRegister.mockResolvedValue(null);

      await processorFn({ connectionId: 'test-id' });

      expect(mockAutoRegister).toHaveBeenCalledWith({
        config: {},
        clientName: ''
      });
    });

    it('should handle special characters in connection id', async () => {
      const specialId = 'test-id-!@#$%^&*()';
      mockDbFindUnique.mockResolvedValue(null);

      await expect(processorFn({ connectionId: specialId })).rejects.toThrow();
      expect(mockDbFindUnique).toHaveBeenCalledWith({
        where: { id: specialId },
        include: expect.any(Object)
      });
    });
  });
});
