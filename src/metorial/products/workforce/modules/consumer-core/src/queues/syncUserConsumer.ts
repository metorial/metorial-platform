import { createSystemAuditScope } from '@metorial/audit-scope';
import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerService } from '../services';
import { reconcileUserConsumersQueue } from './reconcileUserConsumer';

export let syncUserConsumersQueue = createQueue<{ userId: string; cursor?: string }>({
  name: 'cons/syncUser/many'
});

export let syncUserConsumersQueueProcessor = syncUserConsumersQueue.process(async data => {
  let user = await db.user.findUnique({
    where: { id: data.userId }
  });
  if (!user) throw new QueueRetryError();

  let instanceConsumers = await db.instanceConsumer.findMany({
    where: {
      id: { gt: data.cursor },
      consumer: {
        OR: [{ userOid: user.oid }, { organizationMember: { userOid: user.oid } }]
      }
    },
    orderBy: { id: 'asc' },
    take: 100
  });

  await syncUserConsumerQueue.addMany(
    instanceConsumers.map(instanceConsumer => ({
      userId: data.userId,
      instanceConsumerId: instanceConsumer.id
    }))
  );

  if (instanceConsumers.length === 100) {
    await syncUserConsumersQueue.add({
      userId: data.userId,
      cursor: instanceConsumers[instanceConsumers.length - 1]!.id
    });
  }
});

export let syncUserConsumerQueue = createQueue<{
  userId: string;
  instanceConsumerId: string;
}>({
  name: 'cons/syncUser/single'
});

export let syncUserConsumerQueueProcessor = syncUserConsumerQueue.process(async data => {
  let user = await db.user.findUnique({
    where: { id: data.userId }
  });
  if (!user) throw new QueueRetryError();

  let instanceConsumer = await db.instanceConsumer.findFirst({
    where: {
      id: data.instanceConsumerId,
      consumer: {
        OR: [{ userOid: user.oid }, { organizationMember: { userOid: user.oid } }]
      }
    },
    include: { instance: { select: { organizationOid: true } } }
  });
  if (!instanceConsumer) return;

  try {
    await consumerService.updateConsumer({
      consumer: instanceConsumer,
      auditScope: createSystemAuditScope({
        organization: { oid: instanceConsumer.instance.organizationOid },
        job: 'consumer/syncUserConsumer'
      }),
      input: {
        name: user.name,
        email: user.type === 'system' ? instanceConsumer.email : user.email
      }
    });
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;

    await reconcileUserConsumersQueue.add({ userId: user.id });
  }
});

export let syncUserToConsumers = (d: { userId: string }) => syncUserConsumersQueue.add(d);
