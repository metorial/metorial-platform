import { db, ID } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { serverImplementationIndexSingleQueue } from './search';

export let serverImplementationCreatedQueue = createQueue<{ serverImplementationId: string }>({
  name: 'srd/impl/create'
});

export let serverImplementationCreatedQueueProcessor =
  serverImplementationCreatedQueue.process(async data => {
    let implementation = await db.serverImplementation.findUnique({
      where: { id: data.serverImplementationId }
    });
    if (!implementation) throw new Error('retry ... not found');

    let instanceServers = await db.instanceServer.findUnique({
      where: {
        serverOid_instanceOid: {
          serverOid: implementation.serverOid,
          instanceOid: implementation.instanceOid
        }
      }
    });
    if (instanceServers) throw new Error('retry ... not found');

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

    await serverImplementationIndexSingleQueue.add({
      serverImplementationId: implementation.id
    });
  });
