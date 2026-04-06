import { syncSubspaceTenantForProject } from '@metorial/module-subspace';

import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let syncSubspaceTenantQueue = createQueue<{ projectId: string }>({
  name: 'org/sync/subspaceTenant'
});

export let syncSubspaceTenantQueueProcessor = syncSubspaceTenantQueue.process(async data => {
  let project = await db.project.findUnique({
    where: { id: data.projectId }
  });
  if (!project) throw new QueueRetryError();

  await syncSubspaceTenantForProject(project);
});
