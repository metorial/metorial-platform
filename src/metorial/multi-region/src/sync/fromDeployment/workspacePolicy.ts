import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

export let upsertWorkspacePolicy = async (workspacePolicyId: string) => {
  let workspacePolicy = await db.workspacePolicy.findUnique({
    where: { id: workspacePolicyId },
    include: {
      account: true,
      workspace: true
    }
  });
  if (!workspacePolicy) return;

  let inner = {
    status: workspacePolicy.status,
    type: workspacePolicy.type,
    assignmentType: workspacePolicy.assignmentType,
    name: workspacePolicy.name,
    description: workspacePolicy.description,
    accountId: workspacePolicy.account.id,
    workspaceId: workspacePolicy.workspace.id,
    deletedAt: workspacePolicy.deletedAt,
    createdAt: workspacePolicy.createdAt,
    updatedAt: workspacePolicy.updatedAt
  };

  await globalDB.workspacePolicy.upsert({
    where: { id: workspacePolicy.id },
    update: inner,
    create: { id: workspacePolicy.id, ...inner, ownerOid: (await cell).oid }
  });
};

export let syncWorkspacePoliciesCron = createCron(
  {
    name: 'global/sync/from-deployment/wpo',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncWorkspacePoliciesManyQueue.add({});
  }
);

let syncWorkspacePoliciesManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/wpo-many'
});

export let syncWorkspacePoliciesManyQueueProcessor = syncWorkspacePoliciesManyQueue.process(
  async data => {
    let workspacePolicies = await db.workspacePolicy.findMany({
      where: {
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (workspacePolicies.length === 0) return;

    await syncWorkspacePoliciesSingleQueue.addMany(
      workspacePolicies.map(workspacePolicy => ({
        workspacePolicyId: workspacePolicy.id
      }))
    );

    await syncWorkspacePoliciesManyQueue.add({
      cursor: workspacePolicies[workspacePolicies.length - 1].id
    });
  }
);

let syncWorkspacePoliciesSingleQueue = createQueue<{ workspacePolicyId: string }>({
  name: 'global/sync/from-deployment/wpo-single'
});

export let syncWorkspacePoliciesSingleQueueProcessor =
  syncWorkspacePoliciesSingleQueue.process(async data => {
    await upsertWorkspacePolicy(data.workspacePolicyId);
  });

Fabric.listen('workspace_policy.updated:after', async event => {
  await upsertWorkspacePolicy(event.workspacePolicy.id);
});

Fabric.listen('workspace_policy.created:after', async event => {
  await upsertWorkspacePolicy(event.workspacePolicy.id);
});

Fabric.listen('workspace_policy.deleted:after', async event => {
  await upsertWorkspacePolicy(event.workspacePolicy.id);
});
