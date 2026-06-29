import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

export let upsertWorkspaceGroup = async (workspaceGroupId: string) => {
  let workspaceGroup = await db.workspaceGroup.findUnique({
    where: { id: workspaceGroupId },
    include: {
      account: true,
      workspace: true
    }
  });
  if (!workspaceGroup) return;

  let inner = {
    status: workspaceGroup.status,
    type: workspaceGroup.type,
    assignmentType: workspaceGroup.assignmentType,
    name: workspaceGroup.name,
    description: workspaceGroup.description,
    accountId: workspaceGroup.account.id,
    workspaceId: workspaceGroup.workspace.id,
    deletedAt: workspaceGroup.deletedAt,
    createdAt: workspaceGroup.createdAt,
    updatedAt: workspaceGroup.updatedAt
  };

  await globalDB.workspaceGroup.upsert({
    where: { id: workspaceGroup.id },
    update: inner,
    create: { id: workspaceGroup.id, ...inner, ownerOid: (await cell).oid }
  });
};

export let syncWorkspaceGroupsCron = createCron(
  {
    name: 'global/sync/from-deployment/wsg',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncWorkspaceGroupsManyQueue.add({});
  }
);

let syncWorkspaceGroupsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/wsg-many'
});

export let syncWorkspaceGroupsManyQueueProcessor = syncWorkspaceGroupsManyQueue.process(
  async data => {
    let workspaceGroups = await db.workspaceGroup.findMany({
      where: {
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (workspaceGroups.length === 0) return;

    await syncWorkspaceGroupsSingleQueue.addMany(
      workspaceGroups.map(workspaceGroup => ({
        workspaceGroupId: workspaceGroup.id
      }))
    );

    await syncWorkspaceGroupsManyQueue.add({
      cursor: workspaceGroups[workspaceGroups.length - 1].id
    });
  }
);

let syncWorkspaceGroupsSingleQueue = createQueue<{ workspaceGroupId: string }>({
  name: 'global/sync/from-deployment/wsg-single'
});

export let syncWorkspaceGroupsSingleQueueProcessor = syncWorkspaceGroupsSingleQueue.process(
  async data => {
    await upsertWorkspaceGroup(data.workspaceGroupId);
  }
);

Fabric.listen('workspace_group.updated:after', async event => {
  await upsertWorkspaceGroup(event.workspaceGroup.id);
});

Fabric.listen('workspace_group.created:after', async event => {
  await upsertWorkspaceGroup(event.workspaceGroup.id);
});

Fabric.listen('workspace_group.deleted:after', async event => {
  await upsertWorkspaceGroup(event.workspaceGroup.id);
});
