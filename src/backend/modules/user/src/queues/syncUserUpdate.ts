import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let syncUserUpdateQueue = createQueue<{ userId: string }>({
  name: 'usr/syncUserUpdate'
});

export let syncUserUpdateQueueProcessor = syncUserUpdateQueue.process(async data => {
  let user = await db.user.findUnique({
    where: { id: data.userId },
    include: {
      members: { include: { organization: true } }
    }
  });
  if (!user) throw new QueueRetryError();

  await syncUserUpdateSingleQueue.addMany(
    user.members.map(m => ({
      userId: data.userId,
      memberId: m.id
    }))
  );
});

export let syncUserUpdateSingleQueue = createQueue<{ userId: string; memberId: string }>({
  name: 'usr/syncUserUpdateSingle'
});

export let syncUserUpdateSingleQueueProcessor = syncUserUpdateSingleQueue.process(
  async data => {
    let user = await db.user.findUnique({
      where: { id: data.userId }
    });
    if (!user) throw new QueueRetryError();

    let member = await db.organizationMember.findUnique({
      where: { id: data.memberId },
      include: {
        organization: true,
        actor: true
      }
    });
    if (!member) throw new QueueRetryError();

    await Fabric.fire('organization.member.updated:before', {
      member,
      organization: member.organization,
      performedBy: member.actor
    });

    let updatedMember = await db.organizationMember.update({
      where: {
        id: data.memberId
      },
      data: {}
    });

    await Fabric.fire('organization.actor.updated:before', {
      actor: member.actor,
      organization: member.organization,
      performedBy: member.actor
    });

    let updatedActor = await db.organizationActor.update({
      where: { id: member.actor.id },
      data: {
        name: user.name,
        image: user.image as any,
        email: user.email
      }
    });

    await Fabric.fire('organization.actor.updated:after', {
      actor: updatedActor,
      organization: member.organization,
      performedBy: member.actor
    });

    await Fabric.fire('organization.member.updated:after', {
      member,
      organization: member.organization,
      performedBy: member.actor
    });
  }
);
