import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

export let upsertWorkspaceGroupAssignment = async (workspaceGroupAssignmentId: string) => {
  let workspaceGroupAssignment = await db.workspaceGroupAssignment.findUnique({
    where: { id: workspaceGroupAssignmentId },
    include: {
      workspaceGroup: {
        include: {
          account: true,
          workspace: true
        }
      },
      workspaceProfile: true
    }
  });

  if (!workspaceGroupAssignment) {
    await globalDB.workspaceGroupAssignment.deleteMany({
      where: {
        id: workspaceGroupAssignmentId
      }
    });
    return;
  }

  let inner = {
    accountId: workspaceGroupAssignment.workspaceGroup.account.id,
    workspaceId: workspaceGroupAssignment.workspaceGroup.workspace.id,
    workspaceGroupId: workspaceGroupAssignment.workspaceGroup.id,
    workspaceProfileId: workspaceGroupAssignment.workspaceProfile.id
  };

  await globalDB.workspaceGroupAssignment.upsert({
    where: { id: workspaceGroupAssignment.id },
    update: inner,
    create: { id: workspaceGroupAssignment.id, ...inner, ownerOid: (await cell).oid }
  });
};

export let syncWorkspaceGroupAssignmentsCron = createCron(
  {
    name: 'global/sync/from-deployment/wga',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncWorkspaceGroupAssignmentsManyQueue.add({});
  }
);

let syncWorkspaceGroupAssignmentsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/wga-many'
});

export let syncWorkspaceGroupAssignmentsManyQueueProcessor =
  syncWorkspaceGroupAssignmentsManyQueue.process(async data => {
    let workspaceGroupAssignments = await db.workspaceGroupAssignment.findMany({
      where: {
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (workspaceGroupAssignments.length === 0) return;

    await syncWorkspaceGroupAssignmentsSingleQueue.addMany(
      workspaceGroupAssignments.map(workspaceGroupAssignment => ({
        workspaceGroupAssignmentId: workspaceGroupAssignment.id
      }))
    );

    await syncWorkspaceGroupAssignmentsManyQueue.add({
      cursor: workspaceGroupAssignments[workspaceGroupAssignments.length - 1].id
    });
  });

let syncWorkspaceGroupAssignmentsSingleQueue = createQueue<{
  workspaceGroupAssignmentId: string;
}>({
  name: 'global/sync/from-deployment/wga-single'
});

export let syncWorkspaceGroupAssignmentsSingleQueueProcessor =
  syncWorkspaceGroupAssignmentsSingleQueue.process(async data => {
    await upsertWorkspaceGroupAssignment(data.workspaceGroupAssignmentId);
  });

Fabric.listen('workspace_group_assignment.created:after', async event => {
  await syncWorkspaceGroupAssignmentsSingleQueue.add({
    workspaceGroupAssignmentId: event.workspaceGroupAssignment.id
  });
});

Fabric.listen('workspace_group_assignment.deleted:after', async event => {
  let workspaceGroupAssignmentId =
    'workspaceGroupAssignment' in event ? event.workspaceGroupAssignment.id : undefined;
  if (!workspaceGroupAssignmentId) {
    await globalDB.workspaceGroupAssignment.deleteMany({
      where: {
        workspaceGroupId: event.workspaceGroup.id,
        workspaceProfileId: event.workspaceProfile.id
      }
    });
    return;
  }

  await syncWorkspaceGroupAssignmentsSingleQueue.add({
    workspaceGroupAssignmentId
  });
});
