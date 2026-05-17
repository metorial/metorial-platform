import { db } from '@metorial/db';
import {
  ensureInternalProjectTenant,
  ensureInternalScope,
  type InternalService
} from '@metorial/internal-clients';
import { createQueue, QueueRetryError } from '@metorial/queue';

let internalTenantServices: InternalService[] = ['cargo', 'synthesis', 'subspace'];

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

  for (let service of internalTenantServices) {
    await ensureInternalProjectTenant({ service, project });

    for (let instance of instances) {
      await ensureInternalScope({
        service,
        owner: {
          type: 'instance',
          instance
        }
      });
    }
  }
});
