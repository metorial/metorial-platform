import { db, ID } from '@metorial/db';
import { createQueue } from '@metorial/queue';

export let serverImplementationCreatedQueue = createQueue<{ serverImplementationId: string }>({
  name: 'srd/impl/create'
});

export let serverImplementationCreatedQueueProcessor =
  serverImplementationCreatedQueue.process(async data => {
    let implementation = await db.serverImplementation.findUnique({
      where: { id: data.serverImplementationId }
    });
    if (!implementation) return;

    try {
      await db.instanceServer.createMany({
        data: {
          id: await ID.generateId('instanceServer'),
          serverOid: implementation.serverOid,
          instanceOid: implementation.instanceOid
        }
      });
    } catch (e) {
      // Just a unique constraint error
    }
  });
