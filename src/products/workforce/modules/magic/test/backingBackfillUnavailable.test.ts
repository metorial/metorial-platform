import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  dailyPacedDelay: vi.fn(() => ({ delay: 0 })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({ config, handler }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    magicMcpServer: { findUnique: vi.fn() },
    magicMcpEndpoint: { findUnique: vi.fn() }
  }
}));

vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpEndpointBacking: vi.fn(),
  ensureMagicMcpServerBacking: vi.fn()
}));

import { badRequestError, goneError, notFoundError, ServiceError } from '@lowerdeck/error';
import { LockAcquisitionError } from '@lowerdeck/lock';
import { db } from '@metorial/db';
import { QueueRetryError } from '@metorial/queue';
import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking
} from '../src/lib/backing';
import {
  backfillMagicMcpEndpointBackingQueueProcessor,
  backfillMagicMcpServerBackingQueueProcessor
} from '../src/queues/backingBackfill';

let runServer = (backfillMagicMcpServerBackingQueueProcessor as any).handler as (d: {
  magicMcpServerId: string;
}) => Promise<void>;

let runEndpoint = (backfillMagicMcpEndpointBackingQueueProcessor as any).handler as (d: {
  magicMcpEndpointId: string;
}) => Promise<void>;

let unbacked = {
  status: 'active',
  hasSubspaceBacking: false,
  isSubspaceBackingReconciling: false,
  instance: { oid: 10n }
};

let unavailableErrors = {
  'a missing integration instance': () =>
    new ServiceError(notFoundError('integration.instance', 'ini_1')),
  'an inactive integration instance': () =>
    new ServiceError(
      badRequestError({
        message: 'Magic MCP server backing requires an active integration instance.',
        code: 'integration_instance_not_active'
      })
    ),
  'a deleted integration instance': () =>
    new ServiceError(
      badRequestError({
        message: 'Cannot use resource as it has been deleted or archived.',
        entityId: 'ini_1',
        code: 'use_after_delete'
      })
    )
};

describe('magic mcp backing backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue({ ...unbacked } as any);
    vi.mocked(db.magicMcpEndpoint.findUnique).mockResolvedValue({ ...unbacked } as any);
  });

  describe.each(Object.entries(unavailableErrors))('when %s', (_name, createError) => {
    it('skips the server instead of failing the job', async () => {
      vi.mocked(ensureMagicMcpServerBacking).mockRejectedValue(createError());

      await expect(runServer({ magicMcpServerId: 'server_1' })).resolves.toBeUndefined();
    });

    it('skips the endpoint instead of failing the job', async () => {
      vi.mocked(ensureMagicMcpEndpointBacking).mockRejectedValue(createError());

      await expect(runEndpoint({ magicMcpEndpointId: 'endpoint_1' })).resolves.toBeUndefined();
    });
  });

  it('still fails the job for unrelated errors', async () => {
    vi.mocked(ensureMagicMcpServerBacking).mockRejectedValue(
      new ServiceError(
        badRequestError({
          message: 'Cannot use resource as it has been deleted or archived.',
          entityId: 'int_1',
          code: 'use_after_delete'
        })
      )
    );
    vi.mocked(ensureMagicMcpEndpointBacking).mockRejectedValue(
      new ServiceError(goneError({ message: 'Gone' }))
    );

    await expect(runServer({ magicMcpServerId: 'server_1' })).rejects.toBeInstanceOf(
      ServiceError
    );
    await expect(runEndpoint({ magicMcpEndpointId: 'endpoint_1' })).rejects.toBeInstanceOf(
      ServiceError
    );
  });

  it('retries quietly when a backing lock is contended', async () => {
    vi.mocked(ensureMagicMcpServerBacking).mockRejectedValue(
      new LockAcquisitionError(new Error('quorum'))
    );
    vi.mocked(ensureMagicMcpEndpointBacking).mockRejectedValue(
      new LockAcquisitionError(new Error('quorum'))
    );

    await expect(runServer({ magicMcpServerId: 'server_1' })).rejects.toBeInstanceOf(
      QueueRetryError
    );
    await expect(runEndpoint({ magicMcpEndpointId: 'endpoint_1' })).rejects.toBeInstanceOf(
      QueueRetryError
    );
  });

  it('still fails the job for non-service errors', async () => {
    vi.mocked(ensureMagicMcpServerBacking).mockRejectedValue(new Error('boom'));

    await expect(runServer({ magicMcpServerId: 'server_1' })).rejects.toThrow('boom');
  });

  it('backs servers that are available', async () => {
    vi.mocked(ensureMagicMcpServerBacking).mockResolvedValue({} as any);

    await runServer({ magicMcpServerId: 'server_1' });

    expect(ensureMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({ isReconciliation: true })
    );
  });
});
