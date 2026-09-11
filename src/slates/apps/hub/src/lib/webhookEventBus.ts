import { createRedisClient } from '@lowerdeck/redis';
import { env } from '../env';

let redis = createRedisClient({ redisUrl: env.service.REDIS_URL });

let getChannel = (eventId: string) => `shub:whk:evt:${eventId}`;

export let publishWebhookEventResolved = async (eventId: string) => {
  let client = await redis.lazy()();
  await client.publish(getChannel(eventId), '1');
};

export interface WebhookEventSubscription {
  waitForSignal: () => Promise<void>;
  close: () => Promise<void>;
}

export let subscribeToWebhookEvent = async (
  eventId: string
): Promise<WebhookEventSubscription> => {
  let subscriber = (await redis.lazy()()).duplicate();
  await subscriber.connect();

  let channel = getChannel(eventId);
  let resolveSignal: () => void;
  let signalled = new Promise<void>(resolve => {
    resolveSignal = resolve;
  });

  await subscriber.subscribe(channel, () => resolveSignal());

  return {
    waitForSignal: () => signalled,
    close: async () => {
      await subscriber.unsubscribe(channel).catch(() => {});
      await subscriber.disconnect().catch(() => {});
    }
  };
};

export let waitForSignalOrTimeout = async (
  subscription: WebhookEventSubscription,
  timeoutMs: number
): Promise<'signal' | 'timeout'> => {
  return await new Promise(resolve => {
    let timer = setTimeout(() => resolve('timeout'), timeoutMs);
    subscription.waitForSignal().then(() => {
      clearTimeout(timer);
      resolve('signal');
    });
  });
};
