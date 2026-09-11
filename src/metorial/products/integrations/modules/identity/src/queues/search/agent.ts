import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../../../agent/src/env';

export let indexAgentQueue = createQueue<{ agentId: string }>({
  name: 'sub/idn/sidx/agent',
  redisUrl: env.service.REDIS_URL
});

export let indexAgentQueueProcessor = indexAgentQueue.process(async data => {
  let agent = await db.agent.findUnique({
    where: { id: data.agentId },
    include: { tenant: true }
  });
  if (!agent) throw new QueueRetryError();

  if ((!agent.name && !agent.description) || agent.status != 'active') {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.agent.id,
      documentIds: [agent.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.agent.id,

    documentId: agent.id,
    tenantIds: [agent.tenant.id],

    fields: { agentId: agent.id },
    body: {
      name: agent.name,
      description: agent.description
    }
  });
});
