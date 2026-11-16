import { subspaceScopeService } from '@metorial-subspace/module-tenant';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';

export let syncSubspaceTenantQueue = createQueue<{ projectId: string }>({
  name: 'org/sync/subspaceTenant'
});

export let syncSubspaceTenantQueueProcessor = syncSubspaceTenantQueue.process(async data => {
  let project = await db.project.findUnique({
    where: { id: data.projectId }
  });
  if (!project) throw new QueueRetryError();

  let instances = await db.instance.findMany({
    where: {
      projectOid: project.oid
    },
    select: {
      id: true
    }
  });

  await subspaceScopeService.ensureForProject(project);

  for (let instance of instances) {
    await subspaceScopeService.ensureForInstance(instance);
  }
});

export let syncSubspaceTenantProcessors = combineQueueProcessors([
  syncSubspaceTenantQueueProcessor
]);
