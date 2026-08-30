import { createSystemAuditScope } from '@metorial/audit-scope';
import { db } from '@metorial/db';
import { createLock } from '@metorial/lock';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerService } from '../services';
import { reconcileUserConsumersQueue } from './reconcileUserConsumer';

export let syncOrgMemberQueue = createQueue<{
  memberId: string;
}>({
  name: 'cons/syncMem/many'
});

let syncOrgMemberLock = createLock({
  name: 'cons/syncMem/lock'
});

export let syncOrgMemberQueueProcessor = syncOrgMemberQueue.process(async data =>
  syncOrgMemberLock.usingLock(data.memberId, async () => {
    let member = await db.organizationMember.findUnique({
      where: {
        id: data.memberId,
        actor: { type: 'member' }
      },
      include: {
        organization: true,
        instanceConsumers: true,
        user: true
      }
    });
    if (!member) throw new QueueRetryError();
    if (member.user.type === 'system') return;

    if (member.instanceConsumers.length) {
      await syncOrgMemberConsumerQueue.addManyWithOps(
        member.instanceConsumers.map(c => ({
          data: {
            memberId: member.id,
            consumerId: c.id
          },
          opts: {
            id: `${member.id}-${c.id}`
          }
        }))
      );
    } else {
      let instances = await db.instance.findMany({
        where: {
          organizationOid: member.organizationOid
        }
      });

      await createOrgMemberConsumerForInstanceQueue.addManyWithOps(
        instances.map(i => ({
          data: {
            instanceId: i.id,
            memberId: member.id
          },
          opts: {
            id: `${member.id}-${i.id}`
          }
        }))
      );
    }
  })
);

let syncOrgMemberConsumerQueue = createQueue<{
  memberId: string;
  consumerId: string;
}>({
  name: 'cons/syncMem/single'
});

export let syncOrgMemberConsumerQueueProcessor = syncOrgMemberConsumerQueue.process(
  async data => {
    let member = await db.organizationMember.findUnique({
      where: {
        id: data.memberId
      },
      include: { organization: true, actor: true, user: true }
    });
    let consumer = await db.instanceConsumer.findUnique({
      where: {
        id: data.consumerId
      }
    });
    if (!member || !consumer) throw new QueueRetryError();

    try {
      consumer = await consumerService.updateConsumer({
        consumer,
        auditScope: createSystemAuditScope({
          organization: member.organization,
          job: 'consumer/syncOrganizationMember'
        }),
        input: {
          name: member.actor.name,
          email: member.actor.email ?? consumer.email
        }
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;

      await reconcileUserConsumersQueue.add({ userId: member.user.id });
    }
  }
);

let createOrgMemberConsumerForInstanceQueue = createQueue<{
  memberId: string;
  instanceId: string;
}>({
  name: 'cons/syncMem/create-inst'
});

export let createOrgMemberConsumerForInstanceQueueProcessor =
  createOrgMemberConsumerForInstanceQueue.process(async data => {
    let member = await db.organizationMember.findUnique({
      where: {
        id: data.memberId
      },
      include: { organization: true, actor: true }
    });
    let instance = await db.instance.findUnique({
      where: {
        id: data.instanceId
      }
    });
    if (!member || !instance) throw new QueueRetryError();

    if (!member.actor.email || member.actor.type !== 'member') return;

    await consumerService.upsertConsumer({
      organization: member.organization,
      instance,
      member,
      auditScope: createSystemAuditScope({
        organization: member.organization,
        instance,
        job: 'consumer/createOrganizationMemberConsumer'
      }),
      input: {
        name: member.actor.name,
        email: member.actor.email ?? `${member.oid}@${instance.oid}.consumer.metorial.net`
      }
    });
  });
