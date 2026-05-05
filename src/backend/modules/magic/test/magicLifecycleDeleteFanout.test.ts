import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({
      handler
    }))
  })),
  combineQueueProcessors: vi.fn(processors => processors)
}));

vi.mock('@metorial/db', () => ({
  db: {
    magicMcpServer: {
      findUnique: vi.fn()
    },
    magicMcpEndpoint: {
      findUnique: vi.fn()
    },
    magicMcpSession: {
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceMagicMcpBackingService: {}
}));

vi.mock('../src/queues/search/magicMcpServer', () => ({
  indexMagicMcpServerSearchQueue: {
    add: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { indexMagicMcpServerSearchQueue } from '../src/queues/search/magicMcpServer';
import {
  magicMcpEndpointDeletedQueueProcessor
} from '../src/queues/lifecycle/magicMcpEndpoint';
import { magicMcpServerDeletedQueueProcessor } from '../src/queues/lifecycle/magicMcpServer';

describe('magic MCP lifecycle queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-indexes a deleted server', async () => {
    vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue({
      oid: 10n,
      id: 'server-1',
      instance: {
        id: 'instance-1'
      }
    } as any);

    await (magicMcpServerDeletedQueueProcessor as any).handler({
      magicMcpServerId: 'server-1'
    });

    expect(indexMagicMcpServerSearchQueue.add).toHaveBeenCalledWith({
      magicMcpServerId: 'server-1'
    });
  });

  it('handles deleted endpoints without fanout side effects', async () => {
    vi.mocked(db.magicMcpEndpoint.findUnique).mockResolvedValue({
      oid: 20n,
      id: 'endpoint-1',
      hasSubspaceBacking: true,
      instance: {
        id: 'instance-2'
      }
    } as any);

    await (magicMcpEndpointDeletedQueueProcessor as any).handler({
      magicMcpEndpointId: 'endpoint-1'
    });
  });
});
