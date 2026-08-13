import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { metorialDb } from '../../lib/metorialDb';
import { reconcileResourceLinksService } from '../../services/reconcileResourceLinks';

let BATCH_SIZE = 500;

export let reconcileResourceLinksProjectQueue = createQueue<{ projectOid: string }>({
  name: 'sub/ten/res/link/project',
  redisUrl: env.service.REDIS_URL
});

export let reconcileResourceLinksOrganizationActorQueue = createQueue<{
  organizationActorOid: string;
}>({
  name: 'sub/ten/res/link/orgActor',
  redisUrl: env.service.REDIS_URL
});

export let reconcileResourceLinksProjectSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/res/link/project/search',
  redisUrl: env.service.REDIS_URL
});

export let reconcileResourceLinksOrganizationActorSearchQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/ten/res/link/orgActor/search',
  redisUrl: env.service.REDIS_URL
});

export let reconcileResourceLinksCron = createCron(
  {
    name: 'sub/ten/res/link/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '15 4 * * *'
  },
  async () => {
    await reconcileResourceLinksProjectSearchQueue.add(
      {},
      { id: 'subspace-resource-link-project-search' }
    );
    await reconcileResourceLinksOrganizationActorSearchQueue.add(
      {},
      { id: 'subspace-resource-link-org-actor-search' }
    );
  }
);

export let reconcileResourceLinksProjectSearchQueueProcessor =
  reconcileResourceLinksProjectSearchQueue.process(async data => {
    let projects = await metorialDb.project.findMany({
      where: {
        status: 'active',
        subspaceTenantId: { not: null },
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: {
        oid: 'asc'
      },
      take: BATCH_SIZE,
      select: {
        oid: true
      }
    });
    if (projects.length === 0) return;

    await reconcileResourceLinksProjectQueue.addMany(
      projects.map(project => ({
        projectOid: project.oid.toString()
      }))
    );

    let lastProject = projects[projects.length - 1];
    if (!lastProject) return;

    await reconcileResourceLinksProjectSearchQueue.add({
      cursor: lastProject.oid.toString()
    });
  });

export let reconcileResourceLinksProjectQueueProcessor =
  reconcileResourceLinksProjectQueue.process(async data => {
    await reconcileResourceLinksService.reconcileProjectLinks({
      projectOid: BigInt(data.projectOid)
    });
  });

export let reconcileResourceLinksOrganizationActorSearchQueueProcessor =
  reconcileResourceLinksOrganizationActorSearchQueue.process(async data => {
    let organizationActors = await metorialDb.organizationActor.findMany({
      where: {
        subspaceActorId: { not: null },
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: {
        oid: 'asc'
      },
      take: BATCH_SIZE,
      select: {
        oid: true
      }
    });
    if (organizationActors.length === 0) return;

    await reconcileResourceLinksOrganizationActorQueue.addMany(
      organizationActors.map(organizationActor => ({
        organizationActorOid: organizationActor.oid.toString()
      }))
    );

    let lastOrganizationActor = organizationActors[organizationActors.length - 1];
    if (!lastOrganizationActor) return;

    await reconcileResourceLinksOrganizationActorSearchQueue.add({
      cursor: lastOrganizationActor.oid.toString()
    });
  });

export let reconcileResourceLinksOrganizationActorQueueProcessor =
  reconcileResourceLinksOrganizationActorQueue.process(async data => {
    await reconcileResourceLinksService.reconcileOrganizationActorLink({
      organizationActorOid: BigInt(data.organizationActorOid)
    });
  });

export let resourceLinkQueues = combineQueueProcessors([
  reconcileResourceLinksCron,
  reconcileResourceLinksProjectSearchQueueProcessor,
  reconcileResourceLinksProjectQueueProcessor,
  reconcileResourceLinksOrganizationActorSearchQueueProcessor,
  reconcileResourceLinksOrganizationActorQueueProcessor
]);
