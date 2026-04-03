import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { organizationActorService } from '../services/organizationActor';
import { projectBrandService } from '../services/projectBrand';

export let syncBrandQueue = createQueue<{ projectId: string }>({
  name: 'org/syncBrand'
});

export let syncBrandQueueProcessor = syncBrandQueue.process(async data => {
  let project = await db.project.findUnique({
    where: { id: data.projectId },
    include: { organization: true }
  });
  if (!project) throw new QueueRetryError();
  let brand = await db.projectBrand.findFirst({
    where: { projectOid: project.oid, isDefault: true }
  });

  if (brand && brand.isCustomized) return;

  let actor = await organizationActorService.getSystemActor({
    organization: project.organization
  });

  await projectBrandService.upsertProjectBrand({
    project,
    performedBy: actor,
    isAutoUpdate: true,
    input: {
      name: project.name
    }
  });
});
