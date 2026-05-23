import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexAgentClientQueue = createQueue<{ agentClientId: string }>({
  name: 'sub/agt/sidx/client',
  redisUrl: env.service.REDIS_URL
});

export let indexAgentClientQueueProcessor = indexAgentClientQueue.process(async data => {
  let agentClient = await db.agentClient.findUnique({
    where: { id: data.agentClientId },
    include: { tenant: true }
  });
  if (!agentClient) throw new QueueRetryError();

  if (!agentClient.name) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.agentClient.id,
      documentIds: [agentClient.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.agentClient.id,

    documentId: agentClient.id,
    tenantIds: [agentClient.tenant.id],

    fields: {
      agentClientId: agentClient.id,
      type: agentClient.type
    },
    body: {
      name: agentClient.name,
      type: agentClient.type
    }
  });
});
