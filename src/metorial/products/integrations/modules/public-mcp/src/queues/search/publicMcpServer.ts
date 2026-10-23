import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexPublicMcpServerQueue = createQueue<{ publicMcpServerId: string }>({
  name: 'sub/pmcp/sidx/server',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let indexPublicMcpServerQueueProcessor = indexPublicMcpServerQueue.process(
  async data => {
    let publicMcpServer = await db.publicMcpServer.findUnique({
      where: { id: data.publicMcpServerId },
      include: { tenant: true, provider: true }
    });
    if (!publicMcpServer) throw new QueueRetryError();

    if (publicMcpServer.status === 'deleted') {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.publicMcpServer.id,
        documentIds: [publicMcpServer.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.publicMcpServer.id,

      documentId: publicMcpServer.id,
      tenantIds: [publicMcpServer.tenant.id],

      fields: {
        publicMcpServerId: publicMcpServer.id,
        providerId: publicMcpServer.provider.id
      },

      body: {
        name: publicMcpServer.name,
        slug: publicMcpServer.slug,
        description: publicMcpServer.description,
        providerName: publicMcpServer.provider.name
      }
    });
  }
);
