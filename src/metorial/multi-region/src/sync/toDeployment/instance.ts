import { db } from '@metorial/db';
import { generateCode } from '@metorial/id';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { Instance } from '../../db';

export let syncInstanceToDeploymentQueue = createQueue<{
  instance: Instance;
}>({
  name: 'global/sync/to-deployment/instance'
});

export let syncInstanceToDeploymentQueueProcessor = syncInstanceToDeploymentQueue.process(
  async data => {
    let instance = data.instance;

    let cellInstance = await db.cellInstance.upsert({
      where: { id: instance.id },
      update: {
        status: instance.status,
        type: instance.type,
        slug: instance.slug,
        name: instance.name,
        isOwnedByDeployment: instance.ownerOid === (await cell).oid,
        deletedAt: instance.deletedAt,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt
      },
      create: {
        id: instance.id,
        status: instance.status,
        type: instance.type,
        slug: instance.slug,
        name: instance.name,
        isOwnedByDeployment: instance.ownerOid === (await cell).oid,
        deletedAt: instance.deletedAt,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt
      }
    });

    if (!cellInstance.isOwnedByDeployment) {
      let localInstanceWithSameSlug = await db.instance.findFirst({
        where: {
          slug: instance.slug,
          id: { not: instance.id }
        }
      });

      // If there are slug conflicts, whichever instance was created
      // first will keep the slug, and the other instance will have its slug
      // updated to a new slug with a random suffix.
      if (
        localInstanceWithSameSlug &&
        localInstanceWithSameSlug.createdAt > cellInstance.createdAt
      ) {
        console.log(
          `[syncInstanceToDeploymentQueueProcessor] localInstanceWithSameSlug: ${localInstanceWithSameSlug.id} - ${localInstanceWithSameSlug.slug}`
        );

        await db.instance.update({
          where: { id: localInstanceWithSameSlug.id },
          data: { slug: `${localInstanceWithSameSlug.slug}-${generateCode(3)}` }
        });
      }
    }
  }
);
