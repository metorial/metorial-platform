import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let slateTriggerEventProcessQueue = createQueue<{ eventInputId: string }>({
  name: 'shub/trg/evt/proc',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 10_000
    }
  }
});

export let slateTriggerEventSendQueue = createQueue<{ eventId: string }>({
  name: 'shub/trg/evt/snd',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 10_000
    }
  }
});

export let slateTriggerEventInputArchiveQueue = createQueue<{ eventInputId: string }>({
  name: 'shub/trg/evt/inp/arc',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 10_000
    }
  }
});

export let slateTriggerWebhookDispatchOutboxQueue = createQueue<{ outboxId: string }>({
  name: 'shub/trg/webhook/outbox',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export type SlateTriggerRegistrationQueuePayload = {
  receiverTriggerId: string;
  registrationGeneration: number;
  authConfigId?: string;
  callbackSecretIds?: Readonly<Record<string, string>>;
};

export let slateTriggerWebhookRegisterQueue =
  createQueue<SlateTriggerRegistrationQueuePayload>({
    name: 'shub/trg/reg',
    redisUrl: env.service.REDIS_URL,
    workerOpts: {
      concurrency: 5
    }
  });

export let slateTriggerWebhookUnregisterQueue =
  createQueue<SlateTriggerRegistrationQueuePayload>({
    name: 'shub/trg/unreg',
    redisUrl: env.service.REDIS_URL,
    workerOpts: {
      concurrency: 5
    }
  });

export let slateTriggerWebhookRetiringCleanupQueue = createQueue<{
  receiverTriggerId: string;
  registrationGeneration: number;
  registrationVersion: number;
}>({
  name: 'shub/trg/retiring-cleanup',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let slateTriggerWebhookRegistrationRepairQueue = createQueue<{
  cursor?: string;
  batchSize?: number;
}>({
  name: 'shub/trg/registration-repair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let slateTriggerReceiverFinalCleanupQueue = createQueue<{
  batchSize?: number;
}>({
  name: 'shub/trg/receiver-final-cleanup',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let slateTriggerWebhookPayloadCleanupQueue = createQueue<{
  before?: string;
  batchSize?: number;
}>({
  name: 'shub/trg/webhook/payload-cleanup',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

export let slateTriggerWebhookTerminalRepairQueue = createQueue<{
  repairId: string;
}>({
  name: 'shub/trg/webhook/terminal-repair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

export let slateTriggerWebhookReplayCleanupQueue = createQueue<{
  before?: string;
  batchSize?: number;
}>({
  name: 'shub/trg/webhook/replay-cleanup',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});
