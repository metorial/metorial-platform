import { db } from '../db';
import {
  slateTriggerWebhookRegisterQueue,
  slateTriggerWebhookUnregisterQueue
} from '../queues/trigger/eventQueues';
import { registrationJobId } from './slateTriggerRegistrationLifecycle';

export let enqueuePendingRegistrationOutboxes = async (d: {
  outboxIds?: string[];
  batchSize?: number;
  store?: typeof db;
}) => {
  let store = d.store ?? db;
  let pending = await store.slateTriggerRegistrationOutbox.findMany({
    where: {
      status: 'pending',
      ...(d.outboxIds ? { id: { in: d.outboxIds } } : {})
    },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Math.max(d.batchSize ?? 250, 1), 1_000),
    include: { receiverTrigger: { select: { id: true } } }
  });

  for (let outbox of pending) {
    let queue = ['unregister', 'delete'].includes(outbox.operation)
      ? slateTriggerWebhookUnregisterQueue
      : slateTriggerWebhookRegisterQueue;
    await queue.add(
      {
        receiverTriggerId: outbox.receiverTrigger.id,
        registrationGeneration: outbox.registrationGeneration,
        ...(outbox.configGeneration !== null
          ? { configGeneration: outbox.configGeneration }
          : {}),
        ...(outbox.configSecretVersionBindings
          ? {
              configSecretVersionBindings:
                outbox.configSecretVersionBindings as Record<string, number>
            }
          : {})
      },
      {
        id: registrationJobId({
          operation: outbox.operation,
          receiverTriggerId: outbox.receiverTrigger.id,
          registrationGeneration: outbox.registrationGeneration
        })
      }
    );
    await store.slateTriggerRegistrationOutbox.updateMany({
      where: { id: outbox.id, status: 'pending' },
      data: { status: 'enqueued', enqueuedAt: new Date() }
    });
  }

  return pending.length;
};
