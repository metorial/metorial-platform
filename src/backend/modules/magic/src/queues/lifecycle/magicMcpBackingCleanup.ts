import { db, type Prisma, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
import { createQueue } from '@metorial/queue';
import { magicMcpServerDeletedQueue } from './magicMcpServer';

type MagicMcpBackingCleanupQueueInput = {
  instanceId: string;
  integrationId?: string | null;
  integrationInstanceId?: string | null;
};

let archiveLinkedMagicMcpServer = async (d: { magicMcpServerId: string }) => {
  let magicMcpServer = await db.magicMcpServer.findFirst({
    where: {
      id: d.magicMcpServerId,
      ownerType: { in: ['integration', 'server_owned'] },
      status: 'active'
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
    await db.magicMcpEndpointServer.deleteMany({
      where: {
        magicMcpServerOid: magicMcpServer.oid
      }
    });

    return await db.magicMcpServer.update({
      where: { oid: magicMcpServer.oid },
      data: {
        status: 'archived',
        deletedAt: new Date()
      }
    });
  });

  await magicMcpServerDeletedQueue.add({ magicMcpServerId: archived.id });
  await Fabric.fire('magic_mcp.server.archived:after', {
    organization: magicMcpServer.instance.organization,
    instance: magicMcpServer.instance,
    magicMcpServer: archived
  });
};

export let magicMcpBackingCleanupQueue = createQueue<MagicMcpBackingCleanupQueueInput>({
  name: 'mgc/lc/magicMcpBacking/cleanup'
});

export let enqueueMagicMcpBackingCleanup = async (d: MagicMcpBackingCleanupQueueInput) => {
  if (!d.integrationId && !d.integrationInstanceId) return;

  await magicMcpBackingCleanupQueue.add(d);
};

export let magicMcpBackingCleanupQueueProcessor = magicMcpBackingCleanupQueue.process(
  async data => {
    let instance = await db.instance.findUnique({
      where: { id: data.instanceId }
    });
    if (!instance) return;

    let { magicMcpServerBackingIds } =
      await subspaceMagicMcpBackingService.resolveServerBackingIdsByIntegrationResource({
        instance,
        integrationId: data.integrationId,
        integrationInstanceId: data.integrationInstanceId
      });
    let linkedServerFilters: Prisma.MagicMcpServerWhereInput[] = [];

    if (magicMcpServerBackingIds.length) {
      linkedServerFilters.push({
        id: { in: magicMcpServerBackingIds }
      });
    }

    if (data.integrationInstanceId) {
      linkedServerFilters.push({
        subspaceIntegrationInstanceId: data.integrationInstanceId
      });
    }

    if (!linkedServerFilters.length) return;

    let linkedServers = await db.magicMcpServer.findMany({
      where: {
        instanceOid: instance.oid,
        ownerType: { in: ['integration', 'server_owned'] },
        status: 'active',
        OR: linkedServerFilters
      },
      select: {
        id: true
      }
    });

    for (let server of linkedServers) {
      await archiveLinkedMagicMcpServer({ magicMcpServerId: server.id });
    }
  }
);

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
