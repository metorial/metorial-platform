import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { instanceService } from '../services/instance';
import { organizationActorService } from '../services/organizationActor';

export let RECONCILE_PROJECT_INSTANCES_BATCH_SIZE = 500;

export let reconcileProjectInstancesCron = createCron(
  {
    name: 'org/project-instances/reconcile/cron',
    cron: '0 5 * * *'
  },
  async () => {
    await reconcileProjectInstancesSearchQueue.add(
      {},
      { id: 'org-project-instances-reconcile-search' }
    );
  }
);

export let reconcileProjectInstancesSearchQueue = createQueue<{ cursor?: string }>({
  name: 'org/project-instances/reconcile/search'
});

export let reconcileProjectInstancesSearchQueueProcessor =
  reconcileProjectInstancesSearchQueue.process(async data => {
    let projects = await db.project.findMany({
      where: {
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_PROJECT_INSTANCES_BATCH_SIZE,
      select: {
        id: true
      }
    });
    if (projects.length === 0) return;

    await reconcileProjectInstancesQueue.addMany(
      projects.map(project => ({
        projectId: project.id
      }))
    );

    let lastProject = projects[projects.length - 1];
    if (!lastProject) return;

    await reconcileProjectInstancesSearchQueue.add({
      cursor: lastProject.id
    });
  });

export let reconcileProjectInstancesQueue = createQueue<{ projectId: string }>({
  name: 'org/project-instances/reconcile/project',
  workerOpts: { concurrency: 5 }
});

export let reconcileProjectInstancesQueueProcessor = reconcileProjectInstancesQueue.process(
  async data => {
    let project = await db.project.findUnique({
      where: { id: data.projectId },
      include: { organization: true }
    });
    if (!project) throw new QueueRetryError();

    let systemActor = await organizationActorService.getSystemActor({
      organization: project.organization
    });

    await instanceService.reconcileProjectInstances({
      project,
      performedBy: systemActor,
      context: { ip: '0.0.0.0', ua: 'Metorial' }
    });
  }
);

export let reconcileProjectInstancesProcessors = combineQueueProcessors([
  reconcileProjectInstancesCron,
  reconcileProjectInstancesSearchQueueProcessor,
  reconcileProjectInstancesQueueProcessor
]);
