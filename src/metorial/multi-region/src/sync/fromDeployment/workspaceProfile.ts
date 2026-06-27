import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

export let upsertWorkspaceProfile = async (workspaceProfileId: string) => {
  let workspaceProfile = await db.workspaceProfile.findUnique({
    where: { id: workspaceProfileId },
    include: {
      account: true,
      consumer: true,
      consumerProfile: true,
      instanceConsumer: true,
      user: true,
      organizationMember: true,
      workspace: true,
      globalProfile: true
    }
  });
  if (!workspaceProfile) return;

  let inner = {
    status: workspaceProfile.status,
    name: workspaceProfile.name,
    email: workspaceProfile.email,

    accountId: workspaceProfile.account.id,
    workspaceId: workspaceProfile.workspace.id,
    globalProfileId: workspaceProfile.globalProfile.id,

    userId: workspaceProfile.user?.id,
    organizationMemberId: workspaceProfile.organizationMember?.id,

    consumerId: workspaceProfile.consumer?.id,
    consumerProfileId: workspaceProfile.consumerProfile?.id,
    instanceConsumerId: workspaceProfile.instanceConsumer?.id,

    createdAt: workspaceProfile.createdAt,
    updatedAt: workspaceProfile.updatedAt
  };

  await globalDB.workspaceProfile.upsert({
    where: { id: workspaceProfile.id },
    update: inner,
    create: { id: workspaceProfile.id, ...inner, ownerOid: (await cell).oid }
  });
};

let syncWorkspaceProfilesSingleQueue = createQueue<{ workspaceProfileId: string }>({
  name: 'global/sync/from-deployment/wspro-single'
});

export let syncWorkspaceProfilesSingleQueueProcessor =
  syncWorkspaceProfilesSingleQueue.process(async data => {
    await upsertWorkspaceProfile(data.workspaceProfileId);
  });

Fabric.listen('workspace_profile.updated:after', async event => {
  await syncWorkspaceProfilesSingleQueue.add({
    workspaceProfileId: event.workspaceProfile.id
  });
});

Fabric.listen('workspace_profile.created:after', async event => {
  await syncWorkspaceProfilesSingleQueue.add({
    workspaceProfileId: event.workspaceProfile.id
  });
});

Fabric.listen('workspace_profile.deleted:after', async event => {
  await syncWorkspaceProfilesSingleQueue.add({
    workspaceProfileId: event.workspaceProfile.id
  });
});
