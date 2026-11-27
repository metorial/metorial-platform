import { createRedisClient } from '@lowerdeck/redis';
import { env } from '@mtsrc/slates-hub-env/env';

let getRedis = createRedisClient({ redisUrl: env.service.REDIS_URL }).lazy();

let getChannel = (eventId: string) => `shub:whk:evt:${eventId}`;

export let publishWebhookEventResolved = async (eventId: string) => {
  let client = await getRedis();
  await client.publish(getChannel(eventId), '1');
};

export interface WebhookEventSubscription {
  waitForSignal: () => Promise<void>;
  close: () => Promise<void>;
}

export let subscribeToWebhookEvent = async (
  eventId: string
): Promise<WebhookEventSubscription> => {
  let subscriber = (await getRedis()).duplicate();
  subscriber.on('error', error =>
    console.error('Slates webhook Redis subscriber error', error)
  );

  let close = async () => {
    if (subscriber.isOpen) subscriber.destroy();
  };

  let channel = getChannel(eventId);
  let resolveSignal: () => void;
  let signalled = new Promise<void>(resolve => {
    resolveSignal = resolve;
  });

  try {
    await subscriber.connect();
    await subscriber.subscribe(channel, () => resolveSignal());
  } catch (error) {
    await close();
    throw error;
  }

  return {
    waitForSignal: () => signalled,
    close
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
