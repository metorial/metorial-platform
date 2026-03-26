import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexPublisherQueue = createQueue<{ publisherId: string }>({
  name: 'sub/dep/sidx/publisher',
  redisUrl: env.service.REDIS_URL
});

export let indexPublisherQueueProcessor = indexPublisherQueue.process(async data => {
  let publisher = await db.publisher.findUnique({
    where: { id: data.publisherId },
    include: { tenant: true }
  });
  if (!publisher) throw new QueueRetryError();

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.publisher.id,

    documentId: publisher.id,
    tenantIds: publisher.tenant ? [publisher.tenant.id] : [],

    fields: { publisherId: publisher.id, configId: publisher.id },
    body: {
      name: publisher.name,
      description: publisher.description
    }
  });
});
