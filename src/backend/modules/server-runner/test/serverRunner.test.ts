import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverRunnerService } from '../src/services/serverRunner';
import { serverRunnerConnectionService } from '../src/services/serverRunnerConnection';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  ensureServerRunner: vi.fn()
}));

vi.mock('@metorial/id', () => ({
  generateCustomId: vi.fn(() => 'test_connection_key_123')
}));

vi.mock('../src/services/serverRunnerConnection', () => ({
  serverRunnerConnectionService: {
    getOnlineServerRunners: vi.fn()
  }
}));

describe('serverRunnerService', () => {
  let ensureServerRunner: any;
  let generateCustomId: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = await import('@metorial/db');
    ensureServerRunner = db.ensureServerRunner;

    const id = await import('@metorial/id');
    generateCustomId = id.generateCustomId;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('ensureHostedServerRunner', () => {
    it('should create a new hosted server runner with required fields', async () => {
      const mockRunner = {
        oid: 1,
        id: 'test_runner_1',
        identifier: 'test-runner',
        status: 'offline',
        connectionKey: 'test_connection_key_123',
        name: 'Test Runner',
        type: 'hosted'
      };

      ensureServerRunner.mockResolvedValue(mockRunner);

      const result = await serverRunnerService.ensureHostedServerRunner({
        identifier: 'test-runner',
        name: 'Test Runner'
      });

      expect(ensureServerRunner).toHaveBeenCalledWith(
        expect.any(Function),
        { ignoreForUpdate: ['connectionKey'] }
      );

      expect(result).toEqual(mockRunner);
    });

    it('should include optional description and attributes', async () => {
      const mockRunner = {
        oid: 1,
        id: 'test_runner_1',
        identifier: 'test-runner',
        status: 'offline',
        connectionKey: 'test_connection_key_123',
        name: 'Test Runner',
        description: 'Test Description',
        attributes: { test: 'value' },
        type: 'hosted'
      };

      ensureServerRunner.mockResolvedValue(mockRunner);

      const result = await serverRunnerService.ensureHostedServerRunner({
        identifier: 'test-runner',
        name: 'Test Runner',
        description: 'Test Description',
        attributes: { test: 'value' }
      });

      expect(result).toEqual(mockRunner);
    });

    it('should generate a unique connection key with correct prefix', async () => {
      const mockRunner = {
        oid: 1,
        id: 'test_runner_1',
        identifier: 'test-runner',
        status: 'offline',
        connectionKey: 'mt_runner_custom_key_123',
        name: 'Test Runner',
        type: 'hosted'
      };

      generateCustomId.mockReturnValue('mt_runner_custom_key_123');
      ensureServerRunner.mockResolvedValue(mockRunner);

      await serverRunnerService.ensureHostedServerRunner({
        identifier: 'test-runner',
        name: 'Test Runner'
      });

      expect(generateCustomId).toHaveBeenCalledWith('mt_runner', 60);
    });

    it('should set status to offline by default', async () => {
      ensureServerRunner.mockImplementation(async (fn: any, opts: any) => {
        const result = await fn();
        expect(result.status).toBe('offline');
        return result;
      });

      await serverRunnerService.ensureHostedServerRunner({
        identifier: 'test-runner',
        name: 'Test Runner'
      });
    });

    it('should set type to hosted', async () => {
      ensureServerRunner.mockImplementation(async (fn: any, opts: any) => {
        const result = await fn();
        expect(result.type).toBe('hosted');
        return result;
      });

      await serverRunnerService.ensureHostedServerRunner({
        identifier: 'test-runner',
        name: 'Test Runner'
      });
    });
  });

  describe('findServerRunner', () => {
    it('should return an online server runner using round-robin', async () => {
      const mockRunners = [
        { id: 'runner_1', status: 'online', name: 'Runner 1' },
        { id: 'runner_2', status: 'online', name: 'Runner 2' },
        { id: 'runner_3', status: 'online', name: 'Runner 3' }
      ];

      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValue(mockRunners);

      const session = { sessionOid: 1 } as any;

      const result1 = await serverRunnerService.findServerRunner({ session });
      expect(result1).toEqual(mockRunners[0]);

      const result2 = await serverRunnerService.findServerRunner({ session });
      expect(result2).toEqual(mockRunners[1]);

      const result3 = await serverRunnerService.findServerRunner({ session });
      expect(result3).toEqual(mockRunners[2]);

      // Should wrap around
      const result4 = await serverRunnerService.findServerRunner({ session });
      expect(result4).toEqual(mockRunners[0]);
    });

    it('should throw error when no online runners available', async () => {
      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValue([]);

      const session = { sessionOid: 1 } as any;

      await expect(
        serverRunnerService.findServerRunner({ session })
      ).rejects.toThrow('No online server runners available');
    });

    it('should handle single runner repeatedly', async () => {
      const mockRunners = [
        { id: 'runner_1', status: 'online', name: 'Runner 1' }
      ];

      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValue(mockRunners);

      const session = { sessionOid: 1 } as any;

      const result1 = await serverRunnerService.findServerRunner({ session });
      expect(result1).toEqual(mockRunners[0]);

      const result2 = await serverRunnerService.findServerRunner({ session });
      expect(result2).toEqual(mockRunners[0]);
    });

    it('should distribute requests across runners', async () => {
      const mockRunners = [
        { id: 'runner_1', status: 'online', name: 'Runner 1' },
        { id: 'runner_2', status: 'online', name: 'Runner 2' }
      ];

      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValue(mockRunners);

      const session = { sessionOid: 1 } as any;

      const results = [];
      for (let i = 0; i < 4; i++) {
        const result = await serverRunnerService.findServerRunner({ session });
        results.push(result.id);
      }

      // Should alternate between runners
      expect(results).toContain('runner_1');
      expect(results).toContain('runner_2');
    });

    it('should handle runner list changes dynamically', async () => {
      const session = { sessionOid: 1 } as any;

      // First, return 2 runners
      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValueOnce([
        { id: 'runner_1', status: 'online', name: 'Runner 1' },
        { id: 'runner_2', status: 'online', name: 'Runner 2' }
      ]);

      const result1 = await serverRunnerService.findServerRunner({ session });
      expect(result1.id).toBe('runner_1');

      // Then, return 3 runners
      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValueOnce([
        { id: 'runner_1', status: 'online', name: 'Runner 1' },
        { id: 'runner_2', status: 'online', name: 'Runner 2' },
        { id: 'runner_3', status: 'online', name: 'Runner 3' }
      ]);

      const result2 = await serverRunnerService.findServerRunner({ session });
      // Should return one of the runners (round-robin continues)
      expect(['runner_1', 'runner_2', 'runner_3']).toContain(result2.id);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined runner index correctly', async () => {
      const mockRunners = [
        { id: 'runner_1', status: 'online', name: 'Runner 1' }
      ];

      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValue(mockRunners);

      const session = { sessionOid: 1 } as any;

      // First call should work fine
      const result = await serverRunnerService.findServerRunner({ session });
      expect(result).toEqual(mockRunners[0]);
    });

    it('should handle very large runner list', async () => {
      const mockRunners = Array.from({ length: 1000 }, (_, i) => ({
        id: `runner_${i}`,
        status: 'online',
        name: `Runner ${i}`
      }));

      (serverRunnerConnectionService.getOnlineServerRunners as any).mockResolvedValue(mockRunners);

      const session = { sessionOid: 1 } as any;

      // Should handle round-robin for large lists
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await serverRunnerService.findServerRunner({ session });
        results.push(result);
      }

      // All results should be from the mock runners
      results.forEach(result => {
        expect(mockRunners).toContainEqual(result);
      });
    });
  });
});
