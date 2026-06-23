import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { Portal } from '../../db';

export let syncPortalToDeploymentQueue = createQueue<{
  portal: Portal;
}>({
  name: 'global/sync/to-deployment/portal'
});

export let syncPortalToDeploymentQueueProcessor = syncPortalToDeploymentQueue.process(
  async data => {
    let portal = data.portal;

    await db.cellPortal.upsert({
      where: { id: portal.id },
      update: {
        status: portal.status,
        name: portal.name,
        description: portal.description,
        slug: portal.slug,
        isOwnedByDeployment: portal.ownerOid === (await cell).oid,
        archivedAt: portal.archivedAt,
        deletedAt: portal.deletedAt,
        createdAt: portal.createdAt,
        updatedAt: portal.updatedAt
      },
      create: {
        id: portal.id,
        status: portal.status,
        name: portal.name,
        description: portal.description,
        slug: portal.slug,
        isOwnedByDeployment: portal.ownerOid === (await cell).oid,
        archivedAt: portal.archivedAt,
        deletedAt: portal.deletedAt,
        createdAt: portal.createdAt,
        updatedAt: portal.updatedAt
      }
    });
  }
);
