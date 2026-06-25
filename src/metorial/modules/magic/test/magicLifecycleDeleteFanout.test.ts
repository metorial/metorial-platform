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
    }
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceMagicMcpBackingService: {
    archiveServer: vi.fn(),
    archiveEndpoint: vi.fn()
  }
}));

vi.mock('../src/queues/search/magicMcpServer', () => ({
  indexMagicMcpServerSearchQueue: {
    add: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
import { magicMcpEndpointDeletedQueueProcessor } from '../src/queues/lifecycle/magicMcpEndpoint';
import { magicMcpServerDeletedQueueProcessor } from '../src/queues/lifecycle/magicMcpServer';
import { indexMagicMcpServerSearchQueue } from '../src/queues/search/magicMcpServer';

describe('magic MCP lifecycle delete fanout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives a server backing without deleting legacy session templates', async () => {
    let instance = { id: 'instance-1' };
    vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue({
      oid: 10n,
      id: 'server-1',
      hasSubspaceBacking: true,
      instance
    } as any);

    await (magicMcpServerDeletedQueueProcessor as any).handler({
      magicMcpServerId: 'server-1'
    });

    expect(indexMagicMcpServerSearchQueue.add).toHaveBeenCalledWith({
      magicMcpServerId: 'server-1'
    });
    expect(subspaceMagicMcpBackingService.archiveServer).toHaveBeenCalledWith({
      instance,
      magicMcpServerBackingId: 'server-1'
    });
  });

  it('archives an endpoint backing without deleting legacy session rows', async () => {
    let instance = { id: 'instance-2' };
    vi.mocked(db.magicMcpEndpoint.findUnique).mockResolvedValue({
      oid: 20n,
      id: 'endpoint-1',
      hasSubspaceBacking: true,
      instance
    } as any);

    await (magicMcpEndpointDeletedQueueProcessor as any).handler({
      magicMcpEndpointId: 'endpoint-1'
    });

    expect(subspaceMagicMcpBackingService.archiveEndpoint).toHaveBeenCalledWith({
      instance,
      magicMcpEndpointBackingId: 'endpoint-1'
    });
  });
});
