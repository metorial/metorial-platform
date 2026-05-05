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
    instance: {
      findUnique: vi.fn()
    },
    magicMcpServer: {
      findUnique: vi.fn()
    },
    magicMcpEndpoint: {
      findUnique: vi.fn()
    },
    magicMcpSession: {
      findMany: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceSessionService: {
    delete: vi.fn()
  },
  subspaceSessionTemplateService: {
    delete: vi.fn()
  }
}));

vi.mock('../src/queues/search/magicMcpServer', () => ({
  indexMagicMcpServerSearchQueue: {
    add: vi.fn()
  }
}));

import { db } from '@metorial/db';
import {
  subspaceSessionService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
import { indexMagicMcpServerSearchQueue } from '../src/queues/search/magicMcpServer';
import {
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpEndpointDeletedSubspaceSessionQueue,
  magicMcpEndpointDeletedSubspaceSessionQueueProcessor
} from '../src/queues/lifecycle/magicMcpEndpoint';
import {
  magicMcpServerDeletedQueueProcessor,
  magicMcpServerDeletedSubspaceSessionQueue,
  magicMcpServerDeletedSubspaceSessionQueueProcessor
} from '../src/queues/lifecycle/magicMcpServer';

describe('magic MCP lifecycle delete fanout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans out server session deletes into child jobs', async () => {
    vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue({
      oid: 10n,
      id: 'server-1',
      subspaceSessionTemplateId: 'template-inline',
      instance: {
        id: 'instance-1'
      }
    } as any);
    vi.mocked(db.magicMcpSession.findMany)
      .mockResolvedValueOnce([
        { subspaceSessionTemplateId: 'template-a' },
        { subspaceSessionTemplateId: 'template-b' }
      ] as any)
      .mockResolvedValueOnce([
        { subspaceSessionId: 'session-a' },
        { subspaceSessionId: 'session-b' }
      ] as any);

    await (magicMcpServerDeletedQueueProcessor as any).handler({
      magicMcpServerId: 'server-1'
    });

    expect(indexMagicMcpServerSearchQueue.add).toHaveBeenCalledWith({
      magicMcpServerId: 'server-1'
    });
    expect(subspaceSessionTemplateService.delete).toHaveBeenCalledTimes(3);
    expect(magicMcpServerDeletedSubspaceSessionQueue.addMany).toHaveBeenCalledWith([
      {
        instanceId: 'instance-1',
        subspaceSessionId: 'session-a'
      },
      {
        instanceId: 'instance-1',
        subspaceSessionId: 'session-b'
      }
    ]);
    expect(subspaceSessionService.delete).not.toHaveBeenCalled();
  });

  it('fans out endpoint session deletes into child jobs', async () => {
    vi.mocked(db.magicMcpEndpoint.findUnique).mockResolvedValue({
      oid: 20n,
      id: 'endpoint-1',
      instance: {
        id: 'instance-2'
      }
    } as any);
    vi.mocked(db.magicMcpSession.findMany)
      .mockResolvedValueOnce([
        { subspaceSessionTemplateId: 'template-a' },
        { subspaceSessionTemplateId: null }
      ] as any)
      .mockResolvedValueOnce([
        { subspaceSessionId: 'session-a' },
        { subspaceSessionId: 'session-b' }
      ] as any);

    await (magicMcpEndpointDeletedQueueProcessor as any).handler({
      magicMcpEndpointId: 'endpoint-1'
    });

    expect(db.magicMcpSession.deleteMany).toHaveBeenCalledWith({
      where: {
        magicMcpEndpointOid: 20n
      }
    });
    expect(subspaceSessionTemplateService.delete).toHaveBeenCalledTimes(1);
    expect(magicMcpEndpointDeletedSubspaceSessionQueue.addMany).toHaveBeenCalledWith([
      {
        instanceId: 'instance-2',
        subspaceSessionId: 'session-a'
      },
      {
        instanceId: 'instance-2',
        subspaceSessionId: 'session-b'
      }
    ]);
    expect(subspaceSessionService.delete).not.toHaveBeenCalled();
  });

  it('deletes one subspace session per child job', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue({
      id: 'instance-3'
    } as any);

    await (magicMcpServerDeletedSubspaceSessionQueueProcessor as any).handler({
      instanceId: 'instance-3',
      subspaceSessionId: 'session-a'
    });
    await (magicMcpEndpointDeletedSubspaceSessionQueueProcessor as any).handler({
      instanceId: 'instance-3',
      subspaceSessionId: 'session-b'
    });

    expect(subspaceSessionService.delete).toHaveBeenNthCalledWith(1, {
      instance: {
        id: 'instance-3'
      },
      sessionId: 'session-a',
      _allowMagicMcpDelete: true
    });
    expect(subspaceSessionService.delete).toHaveBeenNthCalledWith(2, {
      instance: {
        id: 'instance-3'
      },
      sessionId: 'session-b',
      _allowMagicMcpDelete: true
    });
  });
});
