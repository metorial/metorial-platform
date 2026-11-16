import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

let SYNC_PAGE_SIZE = 500;

export let upsertWorkspace = async (workspaceId: string) => {
  let workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      account: true,
      portal: true,
      organization: true
    }
  });
  if (!workspace) return;

  let inner = {
    status: workspace.status,
    type: workspace.type,
    name: workspace.name,
    accountId: workspace.account.id,
    portalId: workspace.portal?.id,
    organizationId: workspace.organization?.id,
    enterpriseId: workspace.enterpriseId,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };

  await globalDB.workspace.upsert({
    where: { id: workspace.id },
    update: inner,
    create: { id: workspace.id, ...inner, ownerOid: (await cell).oid }
  });
};

export let syncWorkspacesCron = createCron(
  {
    name: 'global/sync/from-deployment/wsp',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncWorkspacesManyQueue.add({});
  }
);

let syncWorkspacesManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/wsp-many',
  workerOpts: { concurrency: 1 }
});

export let syncWorkspacesManyQueueProcessor = syncWorkspacesManyQueue.process(async data => {
  let workspaces = await db.workspace.findMany({
    where: {
      id: { gt: data.cursor }
    },
    orderBy: { id: 'asc' },
    take: SYNC_PAGE_SIZE,
    select: { id: true }
  });
  if (workspaces.length === 0) return;

  await syncWorkspacesSingleQueue.addMany(
    workspaces.map(workspace => ({ workspaceId: workspace.id }))
  );

  if (workspaces.length === SYNC_PAGE_SIZE) {
    await syncWorkspacesManyQueue.add(
      { cursor: workspaces[workspaces.length - 1].id },
      hourlyPacedDelay()
    );
  }
});

let syncWorkspacesSingleQueue = createQueue<{ workspaceId: string }>({
  name: 'global/sync/from-deployment/wsp-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncWorkspacesSingleQueueProcessor = syncWorkspacesSingleQueue.process(
  async data => {
    await upsertWorkspace(data.workspaceId);
  }
);

Fabric.listen('workspace.updated:after', async event => {
  await upsertWorkspace(event.workspace.id);
});

Fabric.listen('workspace.created:after', async event => {
  await upsertWorkspace(event.workspace.id);
});

Fabric.listen('workspace.deleted:after', async event => {
  await syncWorkspacesSingleQueue.add({ workspaceId: event.workspace.id });
});
