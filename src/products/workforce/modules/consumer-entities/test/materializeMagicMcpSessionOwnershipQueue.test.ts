import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let state: {
    processHandler: ((data: any) => Promise<void>) | null;
  } = {
    processHandler: null
  };
  let queue = {
    add: vi.fn(),
    process: vi.fn((handler: (data: any) => Promise<void>) => {
      state.processHandler = handler;
      return {};
    })
  };

  return { queue, state };
});

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => mocks.queue),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerProfile: {
      findUnique: vi.fn()
    },
    magicMcpSession: {
      findUnique: vi.fn()
    },
    magicMcpToken: {
      findUnique: vi.fn()
    },
    magicMcpServer: {
      findUnique: vi.fn()
    },
    magicMcpEndpoint: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('../src/services', () => ({
  consumerIntegrationService: {
    materializeMagicMcpSessionOwnership: vi.fn(),
    markMagicMcpResourcesConsumerReconciled: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { consumerIntegrationService } from '../src/services';
import { enqueueMaterializeMagicMcpSessionOwnership } from '../src/queues/materializeMagicMcpSessionOwnership';

describe('materializeMagicMcpSessionOwnershipQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dedupes enqueueing by consumer profile and session', async () => {
    await enqueueMaterializeMagicMcpSessionOwnership({
      consumerProfileOid: '30',
      magicMcpSessionOid: '70',
      magicMcpTarget: {
        type: 'server',
        magicMcpServerId: 'mms_1'
      }
    });

    expect(mocks.queue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerProfileOid: '30',
        magicMcpSessionOid: '70'
      }),
      { id: '30:70' }
    );
  });

  it('does not materialize sessions that are already reconciled', async () => {
    (db.consumerProfile.findUnique as any).mockResolvedValue({ oid: 30n });
    (db.magicMcpSession.findUnique as any).mockResolvedValue({
      oid: 70n,
      isConsumerReconciled: true
    });

    await mocks.state.processHandler!({
      consumerProfileOid: '30',
      magicMcpSessionOid: '70',
      magicMcpTarget: {
        type: 'server',
        magicMcpServerId: 'mms_1'
      }
    });

    expect(
      consumerIntegrationService.materializeMagicMcpSessionOwnership
    ).not.toHaveBeenCalled();
    expect(
      consumerIntegrationService.markMagicMcpResourcesConsumerReconciled
    ).not.toHaveBeenCalled();
  });
});
