import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createDeploymentStepManager } from '../src/lib/stepManager';
import type { CustomServerDeployment } from '@metorial/db';

// Mock the database and ID modules
vi.mock('@metorial/db', () => ({
  db: {
    customServerDeploymentStep: {
      create: vi.fn(),
      updateMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  }
}));

// Import after mocking
import { db, ID } from '@metorial/db';

describe('createDeploymentStepManager', () => {
  const mockDeployment: CustomServerDeployment = {
    oid: 1,
    id: 'deployment-123',
    status: 'running'
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementations
    (ID.generateId as any).mockResolvedValue('step-id-123');
    (db.customServerDeploymentStep.create as any).mockImplementation(({ data }: any) => ({
      oid: 1,
      id: data.id,
      type: data.type,
      status: data.status,
      index: data.index,
      deploymentOid: data.deploymentOid,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      logs: data.logs
    }));
    (db.customServerDeploymentStep.updateMany as any).mockResolvedValue({ count: 1 });
  });

  describe('createDeploymentStep', () => {
    it('should create a deployment step with default status', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      const result = await manager.createDeploymentStep({
        type: 'started'
      });

      expect(ID.generateId).toHaveBeenCalledWith('customServerDeploymentStep');
      expect(db.customServerDeploymentStep.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'step-id-123',
          type: 'started',
          status: 'running',
          index: 0,
          deploymentOid: mockDeployment.oid,
          endedAt: null
        })
      });
      expect(result.step).toBeDefined();
      expect(result.step.status).toBe('running');
    });

    it('should create a deployment step with custom status', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      const result = await manager.createDeploymentStep({
        type: 'deployed',
        status: 'completed'
      });

      expect(db.customServerDeploymentStep.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'deployed',
          status: 'completed',
          endedAt: expect.any(Date)
        })
      });
    });

    it('should create a deployment step with logs', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      const logs = [
        { lines: ['Starting build'], type: 'info' as const },
        { lines: ['Build completed'], type: 'info' as const }
      ];

      const result = await manager.createDeploymentStep({
        type: 'started',
        log: logs
      });

      const createdLogs = (db.customServerDeploymentStep.create as any).mock.calls[0][0].data.logs;
      expect(createdLogs).toHaveLength(2);
      expect(createdLogs[0][0]).toBeTypeOf('number'); // timestamp
      expect(createdLogs[0][1]).toEqual(['Starting build']);
      expect(createdLogs[1][0]).toBeTypeOf('number'); // timestamp
      expect(createdLogs[1][1]).toEqual(['Build completed']);
    });

    it('should create a deployment step with error logs', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      const logs = [{ lines: ['Error occurred'], type: 'error' as const }];

      const result = await manager.createDeploymentStep({
        type: 'started',
        log: logs
      });

      const createdLogs = (db.customServerDeploymentStep.create as any).mock.calls[0][0].data.logs;
      expect(createdLogs[0][2]).toBe(1); // Error flag
    });

    it('should increment index for each step', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      await manager.createDeploymentStep({ type: 'started' });
      await manager.createDeploymentStep({ type: 'deployed' });
      await manager.createDeploymentStep({ type: 'lambda_deploy_create' });

      const calls = (db.customServerDeploymentStep.create as any).mock.calls;
      expect(calls[0][0].data.index).toBe(0);
      expect(calls[1][0].data.index).toBe(1);
      expect(calls[2][0].data.index).toBe(2);
    });
  });

  describe('complete', () => {
    it('should mark step as completed', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({ type: 'started' });

      await result.complete();

      expect(db.customServerDeploymentStep.updateMany).toHaveBeenCalledWith({
        where: { oid: result.step.oid },
        data: expect.objectContaining({
          status: 'completed',
          endedAt: expect.any(Date)
        })
      });
    });

    it('should mark step as completed with logs', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({ type: 'started' });

      await result.complete([{ lines: ['Build successful'], type: 'info' }]);

      const updateCall = (db.customServerDeploymentStep.updateMany as any).mock.calls[0][0];
      expect(updateCall.data.status).toBe('completed');
      expect(updateCall.data.logs).toBeDefined();
    });

    it('should not update if step is already completed', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({
        type: 'started',
        status: 'completed'
      });

      vi.clearAllMocks();
      await result.complete();

      expect(db.customServerDeploymentStep.updateMany).not.toHaveBeenCalled();
    });

    it('should not update if step is already failed', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({
        type: 'started',
        status: 'failed'
      });

      vi.clearAllMocks();
      await result.complete();

      expect(db.customServerDeploymentStep.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('fail', () => {
    it('should mark step as failed', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({ type: 'started' });

      await result.fail();

      expect(db.customServerDeploymentStep.updateMany).toHaveBeenCalledWith({
        where: { oid: result.step.oid },
        data: expect.objectContaining({
          status: 'failed',
          endedAt: expect.any(Date)
        })
      });
    });

    it('should mark step as failed with error logs', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({ type: 'started' });

      await result.fail([{ lines: ['Build failed'], type: 'error' }]);

      const updateCall = (db.customServerDeploymentStep.updateMany as any).mock.calls[0][0];
      expect(updateCall.data.status).toBe('failed');
      expect(updateCall.data.logs).toBeDefined();
    });

    it('should not update if step is already completed', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({
        type: 'started',
        status: 'completed'
      });

      vi.clearAllMocks();
      await result.fail();

      expect(db.customServerDeploymentStep.updateMany).not.toHaveBeenCalled();
    });

    it('should not update if step is already failed', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({
        type: 'started',
        status: 'failed'
      });

      vi.clearAllMocks();
      await result.fail();

      expect(db.customServerDeploymentStep.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('addLog', () => {
    it('should add info log to running step', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({ type: 'started' });

      await result.addLog(['Processing file 1', 'Processing file 2'], 'info');

      const updateCall = (db.customServerDeploymentStep.updateMany as any).mock.calls[0][0];
      const logs = updateCall.data.logs;
      expect(logs).toHaveLength(1);
      expect(logs[0][0]).toBeTypeOf('number'); // timestamp
      expect(logs[0][1]).toEqual(['Processing file 1', 'Processing file 2']);
    });

    it('should add error log to running step', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({ type: 'started' });

      await result.addLog(['Error message'], 'error');

      const updateCall = (db.customServerDeploymentStep.updateMany as any).mock.calls[0][0];
      const logs = updateCall.data.logs;
      const errorLog = logs[logs.length - 1];
      expect(errorLog[2]).toBe(1); // Error flag
    });

    it('should accumulate multiple logs', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({
        type: 'started',
        log: [{ lines: ['Initial log'], type: 'info' }]
      });

      await result.addLog(['Second log'], 'info');
      await result.addLog(['Third log'], 'info');

      const lastCall = (db.customServerDeploymentStep.updateMany as any).mock.calls[1][0];
      const logs = lastCall.data.logs;
      expect(logs.length).toBe(3);
    });

    it('should add log without type', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const result = await manager.createDeploymentStep({ type: 'started' });

      await result.addLog(['Normal log']);

      const updateCall = (db.customServerDeploymentStep.updateMany as any).mock.calls[0][0];
      const logs = updateCall.data.logs;
      const log = logs[0];
      expect(log[2]).toBeUndefined(); // No error flag
    });
  });

  describe('log format', () => {
    it('should create logs with timestamp', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const beforeTime = Date.now();

      await manager.createDeploymentStep({
        type: 'started',
        log: [{ lines: ['Test log'], type: 'info' }]
      });

      const afterTime = Date.now();
      const createdLogs = (db.customServerDeploymentStep.create as any).mock.calls[0][0].data.logs;
      const timestamp = createdLogs[0][0];

      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should store log lines as array', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      await manager.createDeploymentStep({
        type: 'started',
        log: [{ lines: ['Line 1', 'Line 2', 'Line 3'], type: 'info' }]
      });

      const createdLogs = (db.customServerDeploymentStep.create as any).mock.calls[0][0].data.logs;
      expect(createdLogs[0][1]).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty log array', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      const result = await manager.createDeploymentStep({
        type: 'started',
        log: []
      });

      expect(result.step.logs).toEqual([]);
    });

    it('should handle multiple managers for same deployment', async () => {
      const manager1 = createDeploymentStepManager({ deployment: mockDeployment });
      const manager2 = createDeploymentStepManager({ deployment: mockDeployment });

      await manager1.createDeploymentStep({ type: 'started' });
      await manager2.createDeploymentStep({ type: 'deployed' });

      // Each manager has its own index ref, so both start at 0
      const calls = (db.customServerDeploymentStep.create as any).mock.calls;
      expect(calls[0][0].data.index).toBe(0);
      expect(calls[1][0].data.index).toBe(0);
    });

    it('should handle very long log lines', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const longLine = 'x'.repeat(10000);

      await manager.createDeploymentStep({
        type: 'started',
        log: [{ lines: [longLine], type: 'info' }]
      });

      const createdLogs = (db.customServerDeploymentStep.create as any).mock.calls[0][0].data.logs;
      expect(createdLogs[0][1][0]).toBe(longLine);
    });

    it('should handle many logs', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });
      const manyLogs = Array.from({ length: 100 }, (_, i) => ({
        lines: [`Log ${i}`],
        type: 'info' as const
      }));

      await manager.createDeploymentStep({
        type: 'started',
        log: manyLogs
      });

      const createdLogs = (db.customServerDeploymentStep.create as any).mock.calls[0][0].data.logs;
      expect(createdLogs.length).toBe(100);
    });
  });

  describe('step types', () => {
    it('should support all step types', async () => {
      const manager = createDeploymentStepManager({ deployment: mockDeployment });

      const stepTypes = ['started', 'deployed', 'lambda_deploy_create', 'lambda_deploy_update', 'lambda_deploy_failed'] as const;

      for (const type of stepTypes) {
        await manager.createDeploymentStep({ type: type as any });
      }

      const calls = (db.customServerDeploymentStep.create as any).mock.calls;
      stepTypes.forEach((type, index) => {
        expect(calls[index][0].data.type).toBe(type);
      });
    });
  });
});
