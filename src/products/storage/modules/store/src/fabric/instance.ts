import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { storeTemplateSyncSingleQueue } from '../queues/storeTemplateSync';

Fabric.listen('organization.project.instance.created:after', async ({ project, instance }) => {
  let storeTemplates = await db.storeTemplate.findMany({
    where: {
      type: 'standalone',
      instanceOid: null,
      OR: [
        {
          projectOid: null
        },
        {
          projectOid: project.oid
        }
      ]
    },
    select: {
      id: true
    }
  });

  if (storeTemplates.length === 0) return;

  await storeTemplateSyncSingleQueue.addMany(
    storeTemplates.map(storeTemplate => ({
      storeTemplateId: storeTemplate.id,
      instanceId: instance.id,
      forceFullReconcile: true
    }))
  );
});
