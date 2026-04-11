import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { ConsumerSurface } from '../../db';

export let syncConsumerSurfaceToDeploymentQueue = createQueue<{
  consumerSurface: ConsumerSurface;
}>({
  name: 'global/sync/to-deployment/consumer-surface'
});

export let syncConsumerSurfaceToDeploymentQueueProcessor =
  syncConsumerSurfaceToDeploymentQueue.process(async data => {
    let surface = data.consumerSurface;

    await db.cellConsumerSurface.upsert({
      where: { id: surface.id },
      update: {
        status: surface.status,
        type: surface.type,
        name: surface.name,
        description: surface.description,
        isOwnedByDeployment: surface.ownerOid === (await cell).oid,
        archivedAt: surface.archivedAt,
        deletedAt: surface.deletedAt,
        createdAt: surface.createdAt,
        updatedAt: surface.updatedAt
      },
      create: {
        id: surface.id,
        status: surface.status,
        type: surface.type,
        name: surface.name,
        description: surface.description,
        isOwnedByDeployment: surface.ownerOid === (await cell).oid,
        archivedAt: surface.archivedAt,
        deletedAt: surface.deletedAt,
        createdAt: surface.createdAt,
        updatedAt: surface.updatedAt
      }
    });
  });
