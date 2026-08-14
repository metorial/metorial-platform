import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
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

    let auditScope = createOrganizationActorAuditScope({
      organization: member.organization,
      organizationActor: member.actor,
      context: { ip: '0.0.0.0', ua: 'Metorial System' }
    });
    let actorInput = {
      name: user.name,
      image: user.image as PrismaJson.EntityImage,
      email: user.type === 'system' ? undefined : user.email
    };

    await Fabric.fire('organization.member.updated:before', {
      member,
      organization: member.organization,
      input: {},
      auditScope
    });

    let updatedMember = await db.organizationMember.update({
      where: {
        id: data.memberId
      },
      data: {},
      include: {
        actor: {
          include: {
            organization: true,
            teams: { include: { team: true } }
          }
        },
        organization: true,
        user: true,
        policies: {
          include: {
            accessPolicy: true
          }
        }
      }
    });

    await Fabric.fire('organization.actor.updated:before', {
      actor: member.actor,
      organization: member.organization,
      input: actorInput,
      auditScope
    });

    let updatedActor = await db.organizationActor.update({
      where: { id: member.actor.id },
      data: {
        name: user.name,
        image: user.image as any,
        email: user.type === 'system' ? undefined : user.email
      },
      include: {
        organization: true,
        member: true,
        teams: { include: { team: true } }
      }
    });

    await Fabric.fire('organization.actor.updated:after', {
      actor: updatedActor,
      previousActor: member.actor,
      organization: member.organization,
      input: actorInput,
      auditScope
    });

    await Fabric.fire('organization.member.updated:after', {
      member: updatedMember,
      previousMember: member,
      organization: member.organization,
      input: {},
      auditScope
    });
  }
);
