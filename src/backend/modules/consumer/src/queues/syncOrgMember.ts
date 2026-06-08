import { db } from '@metorial/db';
import { createLock } from '@metorial/lock';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerService } from '../services';

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
        id: data.memberId
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
      include: { organization: true, actor: true }
    });
    let consumer = await db.instanceConsumer.findUnique({
      where: {
        id: data.consumerId
      }
    });
    if (!member || !consumer) throw new QueueRetryError();

    consumer = await consumerService.updateConsumer({
      consumer,
      input: {
        name: member.actor.name,
        email: member.actor.email ?? consumer.email
      }
    });
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

    await consumerService.upsertConsumer({
      organization: member.organization,
      instance,
      member,
      input: {
        name: member.actor.name,
        email: member.actor.email ?? `${member.oid}@${instance.oid}.consumer.metorial.net`
      }
    });
  });
