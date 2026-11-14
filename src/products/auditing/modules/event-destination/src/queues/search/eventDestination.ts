import { voyager, voyagerIndex, voyagerSource } from '@metorial/audit-search';
import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let indexEventDestinationQueue = createQueue<{ eventDestinationId: string }>({
  name: 'audit/eventDestination/search/index',
  workerOpts: { concurrency: 10 }
});

export let indexEventDestinationQueueProcessor = indexEventDestinationQueue.process(
  async data => {
    let eventDestination = await db.eventDestination.findUnique({
      where: { id: data.eventDestinationId },
      include: { organization: true }
    });
    if (!eventDestination) throw new QueueRetryError();

    if (eventDestination.status !== 'active') {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.eventDestination.id,
        documentIds: [eventDestination.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.eventDestination.id,
      documentId: eventDestination.id,
      tenantIds: [eventDestination.organization.id],
      fields: {
        eventDestinationId: eventDestination.id,
        status: eventDestination.status,
        type: eventDestination.type
      },
      body: {
        name: eventDestination.name,
        description: eventDestination.description
      }
    });
  }
);
