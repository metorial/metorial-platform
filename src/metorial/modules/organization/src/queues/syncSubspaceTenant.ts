import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import {
  ensureInternalProjectTenant,
  ensureInternalScope,
  type InternalService
} from '@metorial/internal-clients';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';

let internalTenantServices: InternalService[] = ['cargo', 'synthesis', 'subspace'];

export let SUBSPACE_TENANT_SYNC_BATCH_SIZE = 500;

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

export let syncSubspaceTenantCron = createCron(
  {
    name: 'org/sync/subspaceTenant/cron',
    cron: '0 4 * * *'
  },
  async () => {
    await syncSubspaceTenantSearchQueue.add({}, { id: 'org-sync-subspace-tenant-search' });
  }
);

export let syncSubspaceTenantSearchQueue = createQueue<{ cursor?: string }>({
  name: 'org/sync/subspaceTenant/search'
});

export let syncSubspaceTenantSearchQueueProcessor = syncSubspaceTenantSearchQueue.process(
  async data => {
    let projects = await db.project.findMany({
      where: {
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SUBSPACE_TENANT_SYNC_BATCH_SIZE,
      select: { id: true }
    });
    if (projects.length === 0) return;

    await syncSubspaceTenantQueue.addMany(
      projects.map(project => ({
        projectId: project.id
      }))
    );

    let lastProject = projects[projects.length - 1];
    if (!lastProject) return;

    await syncSubspaceTenantSearchQueue.add({
      cursor: lastProject.id
    });
  }
);

export let syncSubspaceTenantProcessors = combineQueueProcessors([
  syncSubspaceTenantCron,
  syncSubspaceTenantSearchQueueProcessor,
  syncSubspaceTenantQueueProcessor
]);
