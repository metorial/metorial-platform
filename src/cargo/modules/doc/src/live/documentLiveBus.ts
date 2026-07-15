import { generatePlainId } from '@lowerdeck/id';
import { createRedisClient } from '@lowerdeck/redis';
import { env } from '@metorial-cargo/db';
import { hostname } from 'node:os';
import {
  type DocumentLiveBusMessage,
  isDocumentLiveBusMessage,
  shouldDeliverBusMessage
} from './documentLiveBusProtocol';

let liveBusChannel = 'cargo:document:collaboration:live';

let publisherRedisFactory = createRedisClient({
  redisUrl: env.service.REDIS_URL
});
let subscriberRedisFactory = createRedisClient({
  redisUrl: env.service.REDIS_URL
});

let publisherPromise: Promise<any> | undefined;
let subscriberPromise: Promise<any> | undefined;
let subscribed = false;
let handlers = new Set<(message: DocumentLiveBusMessage) => void | Promise<void>>();

export let documentLiveInstanceId =
  process.env.CARGO_INSTANCE_ID ??
  `${hostname() || 'cargo'}:${process.pid}:${generatePlainId(8)}`;

let getPublisher = async () => {
  publisherPromise ??= publisherRedisFactory.eager();
  return await publisherPromise;
};

let getSubscriber = async () => {
  subscriberPromise ??= subscriberRedisFactory.eager();
  return await subscriberPromise;
};

export let publishDocumentLiveBusMessage = async (
  message: Omit<DocumentLiveBusMessage, 'originInstanceId'>
) => {
  try {
    let publisher = await getPublisher();
    await publisher.publish(
      liveBusChannel,
      JSON.stringify({
        ...message,
        originInstanceId: documentLiveInstanceId
      } satisfies DocumentLiveBusMessage)
    );
  } catch (error) {
    console.error('Failed to publish Cargo live document event', error);
  }
};

export let subscribeToDocumentLiveBus = async (
  handler: (message: DocumentLiveBusMessage) => void | Promise<void>
) => {
  handlers.add(handler);
  if (subscribed) return;

  subscribed = true;
  try {
    let subscriber = await getSubscriber();

    await subscriber.subscribe(liveBusChannel, async (raw: string) => {
      try {
        let parsed = JSON.parse(raw);
        if (!isDocumentLiveBusMessage(parsed)) return;
        if (!shouldDeliverBusMessage(parsed, documentLiveInstanceId)) return;

        await Promise.all([...handlers].map(handler => handler(parsed)));
      } catch (error) {
        console.error('Failed to handle Cargo live document event', error);
      }
    });
  } catch (error) {
    subscribed = false;
    throw error;
  }
};

export let __documentLiveBusTestUtils = {
  isDocumentLiveBusMessage,
  shouldDeliverBusMessage
};
