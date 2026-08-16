import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => ({
      handler
    }))
  })),
  combineQueueProcessors: vi.fn(processors => processors)
}));

vi.mock('@metorial/db', () => {
  let db = {
    magicMcpServer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    magicMcpEndpoint: {
      findUnique: vi.fn()
    },
    magicMcpEndpointServer: {
      findMany: vi.fn(),
      deleteMany: vi.fn()
    },
    magicMcpSession: {
      updateMany: vi.fn()
    },
    instance: {
      findUnique: vi.fn()
    },
    providerTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    consumerIntegration: {
      deleteMany: vi.fn()
    },
    consumerAccessListing: {
      findMany: vi.fn()
    },
    consumerAccess: {
      findMany: vi.fn()
    }
  };

  return {
    db,
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('@metorial-subspace/module-integration', () => ({
  magicMcpServerBackingService: {
    archiveMagicMcpServerBacking: vi.fn(),
    resolveMagicMcpIntegrationResourceLinks: vi.fn()
  },
  magicMcpEndpointBackingService: {
    archiveMagicMcpEndpointBacking: vi.fn()
  }
}));

vi.mock('@metorial/module-consumer', () => ({
  enqueueConsumerTargetAccessCleanup: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: vi.fn(),
    fire: vi.fn()
  }
}));

vi.mock('../src/queues/search/magicMcpServer', () => ({
  indexMagicMcpServerSearchQueue: {
    add: vi.fn()
  }
}));

vi.mock('../src/queues/lifecycle/providerTemplate', () => ({
  providerTemplateArchivedQueue: {
    add: vi.fn(),
    addManyWithOps: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { enqueueConsumerTargetAccessCleanup } from '@metorial/module-consumer';
import {
  magicMcpEndpointBackingService,
  magicMcpServerBackingService
} from '@metorial-subspace/module-integration';
import { magicMcpEndpointDeletedQueueProcessor } from '../src/queues/lifecycle/magicMcpEndpoint';
import {
  magicMcpBackingCleanupBackingsManyQueueProcessor,
  magicMcpBackingCleanupIntegrationInstancesManyQueueProcessor,
  magicMcpBackingCleanupManyQueue,
  magicMcpBackingCleanupManyQueueProcessor,
  magicMcpBackingCleanupProviderTemplateQueue,
  magicMcpBackingCleanupProviderTemplateQueueProcessor,
  magicMcpBackingCleanupProviderTemplatesManyQueue,
  magicMcpBackingCleanupProviderTemplatesManyQueueProcessor,
  magicMcpBackingCleanupServerQueue,
  magicMcpBackingCleanupServerQueueProcessor
} from '../src/queues/lifecycle/magicMcpBackingCleanup';
import { magicMcpServerDeletedQueueProcessor } from '../src/queues/lifecycle/magicMcpServer';
import { indexMagicMcpServerSearchQueue } from '../src/queues/search/magicMcpServer';

describe('magic MCP lifecycle delete fanout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.consumerAccessListing.findMany).mockResolvedValue([]);
    vi.mocked(db.consumerAccess.findMany).mockResolvedValue([]);
    vi.mocked(db.providerTemplate.findMany).mockResolvedValue([]);
    vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue([]);
  });

  it('archives a server backing without deleting legacy session templates', async () => {
    let instance = { id: 'instance-1', organization: { id: 'org-1' } };
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
    expect(magicMcpServerBackingService.archiveMagicMcpServerBacking).toHaveBeenCalledWith({
      instance,
      magicMcpServerBackingId: 'server-1'
    });
    expect(db.consumerIntegration.deleteMany).toHaveBeenCalledWith({
      where: { magicMcpServerOid: 10n }
    });
    expect(enqueueConsumerTargetAccessCleanup).toHaveBeenCalledWith({
      organizationId: 'org-1',
      magicMcpServerId: 'server-1'
    });
  });

  it('enqueues single server cleanup jobs from one backing link page', async () => {
    let instance = { id: 'instance-1', oid: 1n };
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);
    vi.mocked(
      magicMcpServerBackingService.resolveMagicMcpIntegrationResourceLinks
    ).mockResolvedValue({
      magicMcpServerBackingIds: ['backing-server-1'],
      integrationInstanceIds: [],
      nextBackingCursor: 'backing-server-1',
      nextIntegrationInstanceCursor: null
    });
    vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([
      { id: 'server-1' },
      { id: 'server-2' }
    ] as any);

    await (magicMcpBackingCleanupBackingsManyQueueProcessor as any).handler({
      instanceId: 'instance-1',
      integrationId: 'integration-1'
    });

    expect(
      magicMcpServerBackingService.resolveMagicMcpIntegrationResourceLinks
    ).toHaveBeenCalledWith({
      instance,
      integrationId: 'integration-1',
      integrationInstanceId: undefined,
      backingCursor: undefined,
      limit: 100,
      includeBackings: true,
      includeIntegrationInstances: false
    });
    expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['backing-server-1'] }
        })
      })
    );
    expect(magicMcpBackingCleanupServerQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { instanceId: 'instance-1', magicMcpServerId: 'server-1' },
        opts: { id: 'server-instance-1-server-1' }
      },
      {
        data: { instanceId: 'instance-1', magicMcpServerId: 'server-2' },
        opts: { id: 'server-instance-1-server-2' }
      }
    ]);
    expect(db.magicMcpServer.update).not.toHaveBeenCalled();
  });

  it('enqueues single server cleanup jobs from one integration instance page', async () => {
    let instance = { id: 'instance-1', oid: 1n };
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);
    vi.mocked(
      magicMcpServerBackingService.resolveMagicMcpIntegrationResourceLinks
    ).mockResolvedValue({
      magicMcpServerBackingIds: [],
      integrationInstanceIds: ['integration-instance-1'],
      nextBackingCursor: null,
      nextIntegrationInstanceCursor: null
    });
    vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([{ id: 'server-1' }] as any);

    await (magicMcpBackingCleanupIntegrationInstancesManyQueueProcessor as any).handler({
      instanceId: 'instance-1',
      integrationId: 'integration-1'
    });

    expect(
      magicMcpServerBackingService.resolveMagicMcpIntegrationResourceLinks
    ).toHaveBeenCalledWith({
      instance,
      integrationId: 'integration-1',
      integrationInstanceId: undefined,
      integrationInstanceCursor: undefined,
      limit: 100,
      includeBackings: false,
      includeIntegrationInstances: true
    });
    expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subspaceIntegrationInstanceId: { in: ['integration-instance-1'] }
        })
      })
    );
    expect(magicMcpBackingCleanupServerQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { instanceId: 'instance-1', magicMcpServerId: 'server-1' },
        opts: { id: 'server-instance-1-server-1' }
      }
    ]);
  });

  it('enqueues provider-template owned servers without resolving the full integration', async () => {
    let instance = { id: 'instance-1', oid: 1n };
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);
    vi.mocked(
      magicMcpServerBackingService.resolveMagicMcpIntegrationResourceLinks
    ).mockResolvedValue({
      magicMcpServerBackingIds: [],
      integrationInstanceIds: [],
      nextBackingCursor: null,
      nextIntegrationInstanceCursor: null
    });
    vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([{ id: 'server-1' }] as any);

    await (magicMcpBackingCleanupManyQueueProcessor as any).handler({
      instanceId: 'instance-1',
      providerTemplateId: 'provider-template-1'
    });

    expect(
      magicMcpServerBackingService.resolveMagicMcpIntegrationResourceLinks
    ).not.toHaveBeenCalled();
    expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerTemplateId: 'provider-template-1'
        })
      })
    );
    expect(magicMcpBackingCleanupServerQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { instanceId: 'instance-1', magicMcpServerId: 'server-1' },
        opts: { id: 'server-instance-1-server-1' }
      }
    ]);
  });

  it('archives one server from the single cleanup queue', async () => {
    let instance = { id: 'instance-1', oid: 1n, organization: { id: 'org-1' } };
    vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue({
      oid: 10n,
      id: 'server-1',
      status: 'active',
      instance
    } as any);
    vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue([]);
    vi.mocked(db.magicMcpServer.update).mockResolvedValue({
      oid: 10n,
      id: 'server-1',
      status: 'archived'
    } as any);

    await (magicMcpBackingCleanupServerQueueProcessor as any).handler({
      instanceId: 'instance-1',
      magicMcpServerId: 'server-1'
    });

    expect(db.magicMcpServer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 10n } })
    );
  });

  it('enqueues archived provider templates for single cleanup', async () => {
    vi.mocked(db.providerTemplate.findMany).mockResolvedValue([
      { id: 'provider-template-1' }
    ] as any);

    await (magicMcpBackingCleanupProviderTemplatesManyQueueProcessor as any).handler({
      instanceId: 'instance-1',
      integrationId: 'integration-1'
    });

    expect(db.providerTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'deleted' }
        })
      })
    );
    expect(magicMcpBackingCleanupProviderTemplateQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { instanceId: 'instance-1', providerTemplateId: 'provider-template-1' },
        opts: { id: 'provider-template-instance-1-provider-template-1' }
      }
    ]);
    expect(magicMcpBackingCleanupManyQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { instanceId: 'instance-1', providerTemplateId: 'provider-template-1' },
        opts: { id: 'provider-template-servers-instance-1-provider-template-1' }
      }
    ]);
  });

  it('cleans access for already archived provider templates', async () => {
    vi.mocked(db.providerTemplate.findFirst).mockResolvedValue({
      oid: 30n,
      id: 'provider-template-1',
      status: 'archived',
      instance: {
        organization: { id: 'org-1' }
      }
    } as any);

    await (magicMcpBackingCleanupProviderTemplateQueueProcessor as any).handler({
      instanceId: 'instance-1',
      providerTemplateId: 'provider-template-1'
    });

    expect(db.providerTemplate.update).not.toHaveBeenCalled();
    expect(enqueueConsumerTargetAccessCleanup).toHaveBeenCalledWith({
      organizationId: 'org-1',
      providerTemplateId: 'provider-template-1'
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

    expect(magicMcpEndpointBackingService.archiveMagicMcpEndpointBacking).toHaveBeenCalledWith(
      {
        instance,
        magicMcpEndpointBackingId: 'endpoint-1'
      }
    );
  });
});
