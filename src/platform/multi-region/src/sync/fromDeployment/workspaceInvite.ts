import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

let SYNC_PAGE_SIZE = 500;

export let upsertWorkspaceInvite = async (workspaceInviteId: string) => {
  let workspaceInvite = await db.workspaceInvite.findUnique({
    where: { id: workspaceInviteId },
    include: {
      account: true,
      workspace: true,
      globalProfile: true,
      consumerInvite: true,
      organizationInvite: true
    }
  });
  if (!workspaceInvite) return;

  let inner = {
    status: workspaceInvite.status,
    email: workspaceInvite.email,
    accountId: workspaceInvite.account.id,
    workspaceId: workspaceInvite.workspace.id,
    globalProfileId: workspaceInvite.globalProfile.id,
    consumerInviteId: workspaceInvite.consumerInvite?.id,
    organizationInviteId: workspaceInvite.organizationInvite?.id,
    enterpriseInviteId: workspaceInvite.enterpriseInviteId,
    deletedAt: workspaceInvite.deletedAt,
    createdAt: workspaceInvite.createdAt,
    updatedAt: workspaceInvite.updatedAt,
    expiresAt: workspaceInvite.expiresAt
  };

  await globalDB.workspaceInvite.upsert({
    where: { id: workspaceInvite.id },
    update: inner,
    create: { id: workspaceInvite.id, ...inner, ownerOid: (await cell).oid }
  });
};

export let syncWorkspaceInvitesCron = createCron(
  {
    name: 'global/sync/from-deployment/wsinv',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncWorkspaceInvitesManyQueue.add({});
  }
);

let syncWorkspaceInvitesManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/wsinv-many',
  workerOpts: { concurrency: 1 }
});

export let syncWorkspaceInvitesManyQueueProcessor = syncWorkspaceInvitesManyQueue.process(
  async data => {
    let workspaceInvites = await db.workspaceInvite.findMany({
      where: {
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: SYNC_PAGE_SIZE,
      select: { id: true }
    });
    if (workspaceInvites.length === 0) return;

    await syncWorkspaceInvitesSingleQueue.addMany(
      workspaceInvites.map(workspaceInvite => ({
        workspaceInviteId: workspaceInvite.id
      }))
    );

    if (workspaceInvites.length === SYNC_PAGE_SIZE) {
      await syncWorkspaceInvitesManyQueue.add(
        { cursor: workspaceInvites[workspaceInvites.length - 1].id },
        hourlyPacedDelay()
      );
    }
  }
);

let syncWorkspaceInvitesSingleQueue = createQueue<{ workspaceInviteId: string }>({
  name: 'global/sync/from-deployment/wsinv-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncWorkspaceInvitesSingleQueueProcessor = syncWorkspaceInvitesSingleQueue.process(
  async data => {
    await upsertWorkspaceInvite(data.workspaceInviteId);
  }
);

Fabric.listen('workspace_invite.updated:after', async event => {
  await upsertWorkspaceInvite(event.workspaceInvite.id);
});

Fabric.listen('workspace_invite.created:after', async event => {
  await upsertWorkspaceInvite(event.workspaceInvite.id);
});

Fabric.listen('workspace_invite.deleted:after', async event => {
  await upsertWorkspaceInvite(event.workspaceInvite.id);
});
