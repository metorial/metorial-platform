import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let syncUserUpdateMemberManyQueue = createQueue<{ userId: string; cursor?: string }>({
  name: 'usr/syncUserUpdateMember/many'
});

export let syncUserUpdateMemberManyQueueProcessor = syncUserUpdateMemberManyQueue.process(
  async data => {
    let user = await db.user.findUnique({
      where: { id: data.userId }
    });

    let members = await db.organizationMember.findMany({
      where: {
        userOid: user?.oid,
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: 100
    });
    if (!members.length) return;

    await syncUserUpdateMemberQueue.addMany(
      members.map(m => ({
        userId: data.userId,
        memberId: m.id
      }))
    );

    await syncUserUpdateMemberManyQueue.add({
      userId: data.userId,
      cursor: members[members.length - 1].id
    });
  }
);

export let syncUserUpdateMemberQueue = createQueue<{ userId: string; memberId: string }>({
  name: 'usr/syncUserUpdateMember'
});

export let syncUserUpdateMemberQueueProcessor = syncUserUpdateMemberQueue.process(
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
        email: user.type === 'system' ? undefined : user.email
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
