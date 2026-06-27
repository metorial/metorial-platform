import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

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
  name: 'global/sync/from-deployment/wsp-many'
});

export let syncWorkspacesManyQueueProcessor = syncWorkspacesManyQueue.process(async data => {
  let workspaces = await db.workspace.findMany({
    where: {
      id: { gt: data.cursor }
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (workspaces.length === 0) return;

  await syncWorkspacesSingleQueue.addMany(
    workspaces.map(workspace => ({ workspaceId: workspace.id }))
  );

  await syncWorkspacesManyQueue.add({ cursor: workspaces[workspaces.length - 1].id });
});

let syncWorkspacesSingleQueue = createQueue<{ workspaceId: string }>({
  name: 'global/sync/from-deployment/wsp-single'
});

export let syncWorkspacesSingleQueueProcessor = syncWorkspacesSingleQueue.process(
  async data => {
    await upsertWorkspace(data.workspaceId);
  }
);

Fabric.listen('workspace.updated:after', async event => {
  await syncWorkspacesSingleQueue.add({ workspaceId: event.workspace.id });
});

Fabric.listen('workspace.created:after', async event => {
  await syncWorkspacesSingleQueue.add({ workspaceId: event.workspace.id });
});

Fabric.listen('workspace.deleted:after', async event => {
  await syncWorkspacesSingleQueue.add({ workspaceId: event.workspace.id });
});
