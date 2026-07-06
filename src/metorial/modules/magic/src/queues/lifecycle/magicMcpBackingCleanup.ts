import { db, type Prisma, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { enqueueConsumerTargetAccessCleanup } from '@metorial/module-consumer';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
import { createQueue } from '@metorial/queue';
import { magicMcpServerDeletedQueue } from './magicMcpServer';
import { providerTemplateArchivedQueue } from './providerTemplate';

type MagicMcpBackingCleanupQueueInput = {
  instanceId: string;
  integrationId?: string | null;
  integrationInstanceId?: string | null;
  providerTemplateId?: string | null;
  serverCursor?: string;
};

type MagicMcpBackingCleanupBackingsManyInput = {
  instanceId: string;
  integrationId?: string | null;
  integrationInstanceId?: string | null;
  backingCursor?: string | null;
  serverCursor?: string;
};

type MagicMcpBackingCleanupIntegrationInstancesManyInput = {
  instanceId: string;
  integrationId?: string | null;
  integrationInstanceId?: string | null;
  integrationInstanceCursor?: string | null;
  serverCursor?: string;
};

type ProviderTemplateCleanupManyInput = {
  instanceId: string;
  integrationId?: string | null;
  providerTemplateId?: string | null;
  cursor?: string | null;
};

type ProviderTemplateCleanupSingleInput = {
  instanceId: string;
  providerTemplateId: string;
};

type ServerCleanupSingleInput = {
  instanceId: string;
  magicMcpServerId: string;
};

let PAGE_SIZE = 100;

let queueJobId = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join('-').replaceAll(':', '-');

let archiveProviderTemplate = async (d: ProviderTemplateCleanupSingleInput) => {
  let providerTemplate = await db.providerTemplate.findFirst({
    where: {
      id: d.providerTemplateId,
      instance: {
        id: d.instanceId
      }
    },
    include: {
      instance: {
        include: {
          organization: true
        }
      }
    }
  });
  if (!providerTemplate) return;

  if (providerTemplate.status === 'active') {
    let archived = await db.providerTemplate.update({
      where: { oid: providerTemplate.oid },
      data: {
        status: 'archived',
        archivedAt: new Date()
      }
    });

    await providerTemplateArchivedQueue.addManyWithOps([
      {
        data: { providerTemplateId: archived.id },
        opts: { id: queueJobId('provider-template-archived', archived.id) }
      }
    ]);
  }

  await enqueueConsumerTargetAccessCleanup({
    organizationId: providerTemplate.instance.organization.id,
    providerTemplateId: providerTemplate.id
  });
};

export let magicMcpBackingCleanupProviderTemplatesManyQueue =
  createQueue<ProviderTemplateCleanupManyInput>({
    name: 'mgc/lc/magicMcpBacking/cleanupProviderTemplatesMany'
  });

export let magicMcpBackingCleanupProviderTemplateQueue =
  createQueue<ProviderTemplateCleanupSingleInput>({
    name: 'mgc/lc/magicMcpBacking/cleanupProviderTemplate'
  });

export let magicMcpBackingCleanupProviderTemplatesManyQueueProcessor =
  magicMcpBackingCleanupProviderTemplatesManyQueue.process(async data => {
    if (!data.integrationId && !data.providerTemplateId) return;

    if (data.providerTemplateId) {
      await magicMcpBackingCleanupProviderTemplateQueue.addManyWithOps([
        {
          data: {
            instanceId: data.instanceId,
            providerTemplateId: data.providerTemplateId
          },
          opts: {
            id: queueJobId('provider-template', data.instanceId, data.providerTemplateId)
          }
        }
      ]);
      return;
    }

    let providerTemplates = await db.providerTemplate.findMany({
      where: {
        instance: {
          id: data.instanceId
        },
        id: data.cursor ? { gt: data.cursor } : undefined,
        subspaceIntegrationId: data.integrationId ?? undefined,
        status: { not: 'deleted' }
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: { id: true }
    });

    await magicMcpBackingCleanupProviderTemplateQueue.addManyWithOps(
      providerTemplates.map(providerTemplate => ({
        data: {
          instanceId: data.instanceId,
          providerTemplateId: providerTemplate.id
        },
        opts: {
          id: queueJobId('provider-template', data.instanceId, providerTemplate.id)
        }
      }))
    );

    let lastProviderTemplate = providerTemplates[providerTemplates.length - 1];
    if (!lastProviderTemplate) return;

    await magicMcpBackingCleanupProviderTemplatesManyQueue.add({
      ...data,
      cursor: lastProviderTemplate.id
    });
  });

export let magicMcpBackingCleanupProviderTemplateQueueProcessor =
  magicMcpBackingCleanupProviderTemplateQueue.process(async data => {
    await archiveProviderTemplate(data);
  });

let archiveLinkedMagicMcpServer = async (d: ServerCleanupSingleInput) => {
  let magicMcpServer = await db.magicMcpServer.findFirst({
    where: {
      id: d.magicMcpServerId,
      status: 'active',
      instance: {
        id: d.instanceId
      }
    },
    include: {
      instance: {
        include: {
          organization: true
        }
      }
    }
  });
  if (!magicMcpServer) return;

  let archived = await withTransaction(async db => {
    let endpointLinks = await db.magicMcpEndpointServer.findMany({
      where: {
        magicMcpServerOid: magicMcpServer.oid
      },
      select: {
        magicMcpEndpointOid: true
      }
    });

    await db.magicMcpEndpointServer.deleteMany({
      where: {
        magicMcpServerOid: magicMcpServer.oid
      }
    });

    if (endpointLinks.length) {
      await db.magicMcpSession.updateMany({
        where: {
          magicMcpEndpointOid: {
            in: endpointLinks.map(link => link.magicMcpEndpointOid)
          }
        },
        data: {
          isConsumerReconciled: false
        }
      });
    }

    return await db.magicMcpServer.update({
      where: { oid: magicMcpServer.oid },
      data: {
        status: 'archived',
        deletedAt: new Date()
      }
    });
  });

  await magicMcpServerDeletedQueue.addManyWithOps([
    {
      data: { magicMcpServerId: archived.id },
      opts: { id: queueJobId('server-deleted', archived.id) }
    }
  ]);
  await Fabric.fire('magic_mcp.server.archived:after', {
    organization: magicMcpServer.instance.organization,
    instance: magicMcpServer.instance,
    magicMcpServer: archived
  });
};

export let magicMcpBackingCleanupManyQueue = createQueue<MagicMcpBackingCleanupQueueInput>({
  name: 'mgc/lc/magicMcpBacking/cleanupMany'
});

export let magicMcpBackingCleanupBackingsManyQueue =
  createQueue<MagicMcpBackingCleanupBackingsManyInput>({
    name: 'mgc/lc/magicMcpBacking/cleanupBackingsMany'
  });

export let magicMcpBackingCleanupIntegrationInstancesManyQueue =
  createQueue<MagicMcpBackingCleanupIntegrationInstancesManyInput>({
    name: 'mgc/lc/magicMcpBacking/cleanupInstancesMany'
  });

export let magicMcpBackingCleanupServerQueue = createQueue<ServerCleanupSingleInput>({
  name: 'mgc/lc/magicMcpBacking/cleanupServer'
});

export let enqueueMagicMcpBackingCleanup = async (d: MagicMcpBackingCleanupQueueInput) => {
  if (!d.integrationId && !d.integrationInstanceId) return;

  await magicMcpBackingCleanupBackingsManyQueue.add(d);
  await magicMcpBackingCleanupIntegrationInstancesManyQueue.add(d);
  if (d.integrationId) {
    await magicMcpBackingCleanupProviderTemplatesManyQueue.add({
      instanceId: d.instanceId,
      integrationId: d.integrationId
    });
  }
};

export let enqueueProviderTemplateBackingCleanup = async (d: {
  instanceId: string;
  integrationId?: string | null;
  providerTemplateId: string;
}) => {
  await magicMcpBackingCleanupManyQueue.add({
    instanceId: d.instanceId,
    providerTemplateId: d.providerTemplateId
  });
  await magicMcpBackingCleanupProviderTemplatesManyQueue.add({
    instanceId: d.instanceId,
    integrationId: d.integrationId,
    providerTemplateId: d.providerTemplateId
  });
};

export let magicMcpBackingCleanupManyQueueProcessor = magicMcpBackingCleanupManyQueue.process(
  async data => {
    let instance = await db.instance.findUnique({
      where: { id: data.instanceId }
    });
    if (!instance) return;

    if (!data.providerTemplateId) return;

    let linkedServers = await db.magicMcpServer.findMany({
      where: {
        instanceOid: instance.oid,
        status: 'active',
        id: data.serverCursor ? { gt: data.serverCursor } : undefined,
        providerTemplateId: data.providerTemplateId
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: {
        id: true
      }
    });

    await magicMcpBackingCleanupServerQueue.addManyWithOps(
      linkedServers.map(server => ({
        data: {
          instanceId: data.instanceId,
          magicMcpServerId: server.id
        },
        opts: {
          id: queueJobId('server', data.instanceId, server.id)
        }
      }))
    );

    let lastServer = linkedServers[linkedServers.length - 1];
    if (!lastServer) return;

    await magicMcpBackingCleanupManyQueue.add({
      ...data,
      serverCursor: lastServer.id
    });
  }
);

export let magicMcpBackingCleanupBackingsManyQueueProcessor =
  magicMcpBackingCleanupBackingsManyQueue.process(async data => {
    let instance = await db.instance.findUnique({
      where: { id: data.instanceId }
    });
    if (!instance) return;

    let { magicMcpServerBackingIds, nextBackingCursor } =
      await subspaceMagicMcpBackingService.resolveIntegrationResourceLinks({
        instance,
        integrationId: data.integrationId,
        integrationInstanceId: data.integrationInstanceId,
        backingCursor: data.backingCursor,
        limit: PAGE_SIZE,
        includeBackings: true,
        includeIntegrationInstances: false
      });

    if (!magicMcpServerBackingIds.length) {
      if (nextBackingCursor) {
        await magicMcpBackingCleanupBackingsManyQueue.add({
          ...data,
          backingCursor: nextBackingCursor,
          serverCursor: undefined
        });
      }
      return;
    }

    let linkedServers = await db.magicMcpServer.findMany({
      where: {
        instanceOid: instance.oid,
        status: 'active',
        id: {
          ...(data.serverCursor ? { gt: data.serverCursor } : {}),
          in: magicMcpServerBackingIds
        }
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: {
        id: true
      }
    });

    await magicMcpBackingCleanupServerQueue.addManyWithOps(
      linkedServers.map(server => ({
        data: {
          instanceId: data.instanceId,
          magicMcpServerId: server.id
        },
        opts: {
          id: queueJobId('server', data.instanceId, server.id)
        }
      }))
    );

    let lastServer = linkedServers[linkedServers.length - 1];

    if (lastServer) {
      await magicMcpBackingCleanupBackingsManyQueue.add({
        ...data,
        serverCursor: lastServer.id
      });
      return;
    }

    if (!nextBackingCursor) return;

    await magicMcpBackingCleanupBackingsManyQueue.add({
      ...data,
      backingCursor: nextBackingCursor,
      serverCursor: undefined
    });
  });

export let magicMcpBackingCleanupIntegrationInstancesManyQueueProcessor =
  magicMcpBackingCleanupIntegrationInstancesManyQueue.process(async data => {
    let instance = await db.instance.findUnique({
      where: { id: data.instanceId }
    });
    if (!instance) return;

    let { integrationInstanceIds, nextIntegrationInstanceCursor } =
      await subspaceMagicMcpBackingService.resolveIntegrationResourceLinks({
        instance,
        integrationId: data.integrationId,
        integrationInstanceId: data.integrationInstanceId,
        integrationInstanceCursor: data.integrationInstanceCursor,
        limit: PAGE_SIZE,
        includeBackings: false,
        includeIntegrationInstances: true
      });

    if (!integrationInstanceIds.length) {
      if (nextIntegrationInstanceCursor) {
        await magicMcpBackingCleanupIntegrationInstancesManyQueue.add({
          ...data,
          integrationInstanceCursor: nextIntegrationInstanceCursor,
          serverCursor: undefined
        });
      }
      return;
    }

    let linkedServers = await db.magicMcpServer.findMany({
      where: {
        instanceOid: instance.oid,
        status: 'active',
        id: data.serverCursor ? { gt: data.serverCursor } : undefined,
        subspaceIntegrationInstanceId: { in: integrationInstanceIds }
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: {
        id: true
      }
    });

    await magicMcpBackingCleanupServerQueue.addManyWithOps(
      linkedServers.map(server => ({
        data: {
          instanceId: data.instanceId,
          magicMcpServerId: server.id
        },
        opts: {
          id: queueJobId('server', data.instanceId, server.id)
        }
      }))
    );

    let lastServer = linkedServers[linkedServers.length - 1];

    if (lastServer) {
      await magicMcpBackingCleanupIntegrationInstancesManyQueue.add({
        ...data,
        serverCursor: lastServer.id
      });
      return;
    }

    if (!nextIntegrationInstanceCursor) return;

    await magicMcpBackingCleanupIntegrationInstancesManyQueue.add({
      ...data,
      integrationInstanceCursor: nextIntegrationInstanceCursor,
      serverCursor: undefined
    });
  });

export let magicMcpBackingCleanupServerQueueProcessor =
  magicMcpBackingCleanupServerQueue.process(async data => {
    await archiveLinkedMagicMcpServer(data);
  });

Fabric.listen('provider.integration.deleted:after', async event => {
  await enqueueMagicMcpBackingCleanup({
    instanceId: event.instance.id,
    integrationId: event.integration.id
  });
});

Fabric.listen('provider.integration_instance.deleted:after', async event => {
  await enqueueMagicMcpBackingCleanup({
    instanceId: event.instance.id,
    integrationInstanceId: event.integrationInstance.id
  });
});
