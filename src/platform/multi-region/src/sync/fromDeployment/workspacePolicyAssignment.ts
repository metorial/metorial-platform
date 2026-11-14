import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

let SYNC_PAGE_SIZE = 500;

export let upsertWorkspacePolicyAssignment = async (workspacePolicyAssignmentId: string) => {
  let workspacePolicyAssignment = await db.workspacePolicyAssignment.findUnique({
    where: { id: workspacePolicyAssignmentId },
    include: {
      workspacePolicy: {
        include: {
          account: true,
          workspace: true
        }
      },
      workspaceGroup: true,
      workspaceProfile: true
    }
  });

  if (!workspacePolicyAssignment) {
    await globalDB.workspacePolicyAssignment.deleteMany({
      where: {
        id: workspacePolicyAssignmentId
      }
    });
    return;
  }

  let inner = {
    accountId: workspacePolicyAssignment.workspacePolicy.account.id,
    workspaceId: workspacePolicyAssignment.workspacePolicy.workspace.id,
    workspacePolicyId: workspacePolicyAssignment.workspacePolicy.id,
    workspaceGroupId: workspacePolicyAssignment.workspaceGroup?.id ?? null,
    workspaceProfileId: workspacePolicyAssignment.workspaceProfile?.id ?? null
  };

  await globalDB.workspacePolicyAssignment.upsert({
    where: { id: workspacePolicyAssignment.id },
    update: inner,
    create: { id: workspacePolicyAssignment.id, ...inner, ownerOid: (await cell).oid }
  });
};

export let syncWorkspacePolicyAssignmentsCron = createCron(
  {
    name: 'global/sync/from-deployment/wpa',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncWorkspacePolicyAssignmentsManyQueue.add({});
  }
);

let syncWorkspacePolicyAssignmentsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/wpa-many',
  workerOpts: { concurrency: 1 }
});

export let syncWorkspacePolicyAssignmentsManyQueueProcessor =
  syncWorkspacePolicyAssignmentsManyQueue.process(async data => {
    let workspacePolicyAssignments = await db.workspacePolicyAssignment.findMany({
      where: {
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: SYNC_PAGE_SIZE,
      select: { id: true }
    });
    if (workspacePolicyAssignments.length === 0) return;

    await syncWorkspacePolicyAssignmentsSingleQueue.addMany(
      workspacePolicyAssignments.map(workspacePolicyAssignment => ({
        workspacePolicyAssignmentId: workspacePolicyAssignment.id
      }))
    );

    if (workspacePolicyAssignments.length === SYNC_PAGE_SIZE) {
      await syncWorkspacePolicyAssignmentsManyQueue.add(
        { cursor: workspacePolicyAssignments[workspacePolicyAssignments.length - 1].id },
        hourlyPacedDelay()
      );
    }
  });

let syncWorkspacePolicyAssignmentsSingleQueue = createQueue<{
  workspacePolicyAssignmentId: string;
}>({
  name: 'global/sync/from-deployment/wpa-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncWorkspacePolicyAssignmentsSingleQueueProcessor =
  syncWorkspacePolicyAssignmentsSingleQueue.process(async data => {
    await upsertWorkspacePolicyAssignment(data.workspacePolicyAssignmentId);
  });

Fabric.listen('workspace_policy_assignment.created:after', async event => {
  await upsertWorkspacePolicyAssignment(event.workspacePolicyAssignment.id);
});

Fabric.listen('workspace_policy_assignment.deleted:after', async event => {
  await upsertWorkspacePolicyAssignment(event.workspacePolicyAssignment.id);
});
