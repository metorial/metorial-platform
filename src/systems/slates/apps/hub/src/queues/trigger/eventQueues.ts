import { createQueue } from '@mtsrc/queue';
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

export let slateTriggerWebhookRegisterQueue = createQueue<{ receiverTriggerId: string }>({
  name: 'shub/trg/reg',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

export let slateTriggerWebhookUnregisterQueue = createQueue<{ receiverTriggerId: string }>({
  name: 'shub/trg/unreg',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});
