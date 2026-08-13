import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  deleteDirty,
  dirtyUpsert,
  findDirty,
  findStream,
  generateId,
  scavengeAdd,
  syncAdd,
  syncAddMany,
  syncBatch
} = vi.hoisted(() => ({
  deleteDirty: vi.fn(),
  dirtyUpsert: vi.fn(),
  findDirty: vi.fn(),
  findStream: vi.fn(),
  generateId: vi.fn(),
  scavengeAdd: vi.fn(),
  syncAdd: vi.fn(),
  syncAddMany: vi.fn(),
  syncBatch: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => ({ handler }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config: { name: string }) => {
    let isSync = config.name == 'audit/stream/sync';
    return {
      add: isSync ? syncAdd : scavengeAdd,
      addMany: isSync ? syncAddMany : vi.fn(),
      process: vi.fn(handler => ({ handler }))
    };
  })
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn((_key, handler) => handler())
  }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    auditLogDirtyTracker: {
      findMany: findDirty,
      deleteMany: deleteDirty,
      upsert: dirtyUpsert
    },
    auditLogStream: {
      findUnique: findStream
    }
  },
  ID: {
    generateId
  }
}));

vi.mock('../internal/auditLogStreamSync', () => ({
  auditLogStreamSyncService: {
    syncBatch
  }
}));

import {
  scavengeDirtyAuditLogOrganizationsCron,
  scavengeDirtyAuditLogOrganizationsQueueProcessor,
  syncAuditLogStreamQueueProcessor
} from './sync';

describe('audit log stream sync queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let runNumber = 0;
    let batchNumber = 0;
    generateId.mockImplementation(async type => {
      if (type == 'auditLogStreamRun') return `alsr_${++runNumber}`;
      if (type == 'auditLogStreamBatch') return `alsb_${++batchNumber}`;
      throw new Error(`Unexpected id type: ${type}`);
    });
    syncAdd.mockResolvedValue(undefined);
    syncAddMany.mockResolvedValue(undefined);
    scavengeAdd.mockResolvedValue(undefined);
    deleteDirty.mockResolvedValue({ count: 1 });
  });

  it('fans dirty organizations into stream jobs and deletes the observed revision', async () => {
    findDirty.mockResolvedValue([
      {
        organizationOid: 2n,
        revision: 7,
        organization: {
          auditLogStreams: [{ id: 'als_1' }, { id: 'als_2' }]
        }
      }
    ]);

    await (scavengeDirtyAuditLogOrganizationsQueueProcessor as any).handler({});

    expect(findDirty).toHaveBeenCalledWith({
      where: {
        organizationOid: undefined
      },
      include: {
        organization: {
          select: {
            auditLogStreams: {
              where: {
                status: 'active',
                isPausedDueToError: false
              },
              select: { id: true }
            }
          }
        }
      },
      orderBy: { organizationOid: 'asc' },
      take: 100
    });
    expect(syncAddMany).toHaveBeenCalledWith([
      {
        auditLogStreamId: 'als_1',
        runId: 'alsr_1',
        batchIdentifier: 'alsb_1',
        batchNumber: 1,
        successfulBatchCount: 0
      },
      {
        auditLogStreamId: 'als_2',
        runId: 'alsr_2',
        batchIdentifier: 'alsb_2',
        batchNumber: 1,
        successfulBatchCount: 0
      }
    ]);
    expect(deleteDirty).toHaveBeenCalledWith({
      where: {
        organizationOid: 2n,
        revision: 7
      }
    });
  });

  it('continues paginating after a full dirty-organization page', async () => {
    findDirty.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({
        organizationOid: BigInt(index + 1),
        revision: 1,
        organization: {
          auditLogStreams: []
        }
      }))
    );

    await (scavengeDirtyAuditLogOrganizationsQueueProcessor as any).handler({});

    expect(scavengeAdd).toHaveBeenCalledWith({ cursor: '100' });
  });

  it('schedules the next 100-record job with the shared batch identifier', async () => {
    syncBatch.mockResolvedValue({
      status: 'success',
      recordsSynced: 100,
      successfulBatchCount: 3,
      shouldContinue: true
    });

    await (syncAuditLogStreamQueueProcessor as any).handler({
      auditLogStreamId: 'als_1',
      runId: 'alsr_current',
      batchIdentifier: 'alsb_shared',
      batchNumber: 3,
      successfulBatchCount: 2
    });

    expect(syncAdd).toHaveBeenCalledWith(
      {
        auditLogStreamId: 'als_1',
        runId: 'alsr_1',
        batchIdentifier: 'alsb_shared',
        batchNumber: 4,
        successfulBatchCount: 3
      },
      {
        id: 'als_1:alsb_shared:4'
      }
    );
  });

  it('does not continue a failed delivery chain', async () => {
    syncBatch.mockResolvedValue({
      status: 'error',
      recordsSynced: 0,
      successfulBatchCount: 2,
      shouldContinue: false
    });

    await (syncAuditLogStreamQueueProcessor as any).handler({
      auditLogStreamId: 'als_1',
      runId: 'alsr_current',
      batchIdentifier: 'alsb_shared',
      batchNumber: 3,
      successfulBatchCount: 2
    });

    expect(syncAdd).not.toHaveBeenCalled();
  });

  it('re-dirties the organization when a batch job throws', async () => {
    syncBatch.mockRejectedValueOnce(new Error('worker crashed'));
    findStream.mockResolvedValue({
      organizationOid: 2n,
      isPausedDueToError: false
    });
    dirtyUpsert.mockResolvedValue({});

    await expect(
      (syncAuditLogStreamQueueProcessor as any).handler({
        auditLogStreamId: 'als_1',
        runId: 'alsr_current',
        batchIdentifier: 'alsb_shared',
        batchNumber: 3,
        successfulBatchCount: 2
      })
    ).rejects.toThrow('worker crashed');

    expect(dirtyUpsert).toHaveBeenCalledWith({
      where: { organizationOid: 2n },
      create: { organizationOid: 2n },
      update: { revision: { increment: 1 } }
    });
    expect(syncAdd).not.toHaveBeenCalled();
  });

  it('does not re-dirty a stream that is paused due to errors', async () => {
    syncBatch.mockRejectedValueOnce(new Error('worker crashed'));
    findStream.mockResolvedValue({
      organizationOid: 2n,
      isPausedDueToError: true
    });

    await expect(
      (syncAuditLogStreamQueueProcessor as any).handler({
        auditLogStreamId: 'als_1',
        runId: 'alsr_current',
        batchIdentifier: 'alsb_shared',
        batchNumber: 3,
        successfulBatchCount: 2
      })
    ).rejects.toThrow('worker crashed');

    expect(dirtyUpsert).not.toHaveBeenCalled();
  });

  it('starts the scavenger every fifteen minutes', async () => {
    await (scavengeDirtyAuditLogOrganizationsCron as any).handler();

    expect(scavengeAdd).toHaveBeenCalledWith({}, { id: 'audit-stream-dirty-organizations' });
  });
});
