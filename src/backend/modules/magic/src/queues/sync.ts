import { db } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { createQueue } from '@metorial/queue';

export let syncMagicMcpServerQueue = createQueue<{
  magicMcpServerId: string;
}>({
  name: 'mgc/srv/snc'
});

export let syncMagicMcpServerQueueProcessor = syncMagicMcpServerQueue.process(async data => {
  let server = await db.magicMcpServer.findUnique({
    where: {
      id: data.magicMcpServerId
    },
    include: {
      instance: true,
      serverDeployment: {
        include: {
          serverDeployment: {
            include: {
              server: true
            }
          }
        }
      }
    }
  });
  if (!server) throw new Error('retry ... not found');

  await searchService.indexDocument({
    index: 'magic_mcp_server',
    document: {
      id: server.id,
      instanceId: server.instance.id,
      name: server.name ?? server.serverDeployment?.serverDeployment.name,
      description: server.description ?? server.serverDeployment?.serverDeployment.description,
      serverName: server.serverDeployment?.serverDeployment.name,
      serverDescription: server.serverDeployment?.serverDeployment.description
    }
  });
});
