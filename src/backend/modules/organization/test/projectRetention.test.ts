import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn().mockImplementation(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'QueueRetryError';
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    project: {
      update: vi.fn()
    }
  },
  addAfterTransactionHook: vi.fn(async callback => await callback()),
  withTransaction: vi.fn(callback =>
    callback({
      project: {
        update: vi.fn()
      }
    })
  )
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@mtsrc/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../src/queues/syncSubspaceTenant', () => ({
  syncSubspaceTenantQueue: {
    add: vi.fn()
  }
}));

import { withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { syncSubspaceTenantQueue } from '../src/queues/syncSubspaceTenant';
import { projectRetentionService } from '../src/services/projectRetention';

describe('ProjectRetentionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectRetention', () => {
    it('returns retention fields from the project', async () => {
      let project = {
        id: 'proj-1',
        status: 'active',
        logRetentionInDays: 14,
        enforceSessionExpiry: true
      };

      let result = await projectRetentionService.getProjectRetention({
        project: project as any
      });

      expect(result).toEqual({
        logRetentionInDays: 14,
        enforceSessionExpiry: true
      });
    });
  });

  describe('updateProjectRetention', () => {
    it('persists retention fields and enqueues subspace tenant sync', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'active',
        logRetentionInDays: 30,
        enforceSessionExpiry: false,
        organization: mockOrg
      };
      let updatedProject = {
        ...mockProject,
        logRetentionInDays: 7,
        enforceSessionExpiry: true
      };
      let update = vi.fn().mockResolvedValue(updatedProject);

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            update
          }
        };
        return callback(mockDb as any);
      });

      let result = await projectRetentionService.updateProjectRetention({
        project: mockProject as any,
        organization: mockOrg as any,
        performedBy: mockActor as any,
        context: {} as any,
        input: {
          logRetentionInDays: 7,
          enforceSessionExpiry: true
        }
      });

      expect(result).toEqual(updatedProject);
      expect(update).toHaveBeenCalledWith({
        where: { oid: mockProject.oid },
        data: {
          logRetentionInDays: 7,
          enforceSessionExpiry: true
        },
        include: {
          organization: true
        }
      });
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.retention.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.retention.updated:after',
        expect.objectContaining({
          project: updatedProject
        })
      );
      expect(syncSubspaceTenantQueue.add).toHaveBeenCalledWith({
        projectId: 'proj-1'
      });
    });
  });
});
