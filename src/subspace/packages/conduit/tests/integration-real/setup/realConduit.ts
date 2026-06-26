import { randomUUID } from 'node:crypto';
import type { TopicHandler } from '../../../src/core/conduitReceiver';
import type { MessageHandler } from '../../../src/core/receiver';
import {
  createConduit,
  createRedisNatsConduit,
  type Receiver,
  type ReceiverConfig,
  type Sender,
  type SenderConfig
} from '../../../src/index';
import { getTestConnection } from './connection';

type Conduit = ReturnType<typeof createConduit> & { conduitId: string };

interface Stoppable {
  stop: () => Promise<void>;
}

interface Tracked {
  receivers: Stoppable[];
  senders: Sender[];
  conduits: Conduit[];
}

let tracked: Tracked = { receivers: [], senders: [], conduits: [] };

export let makeConduitId = () => `it-${randomUUID()}`;

export let makeConduit = (conduitId: string = makeConduitId()): Conduit => {
  let conn = getTestConnection();
  let base = createConduit(
    createRedisNatsConduit({
      conduitId,
      redisConfig: { host: conn.redis.host, port: conn.redis.port },
      natsConfig: { servers: [conn.natsUrl] }
    })
  );

  let conduit = Object.assign(base, { conduitId });
  tracked.conduits.push(conduit);
  return conduit;
};

export let trackReceiver = (receiver: Receiver): Receiver => {
  tracked.receivers.push(receiver);
  return receiver;
};

export let trackSender = (sender: Sender): Sender => {
  tracked.senders.push(sender);
  return sender;
};

/** Convenience: a conduit with a single started receiver. */
export let makeReceiverNode = async (
  conduitId: string,
  handler: MessageHandler,
  config?: Partial<ReceiverConfig>
) => {
  let conduit = makeConduit(conduitId);
  let receiver = trackReceiver(conduit.createReceiver(handler, config));
  await receiver.start();
  return { conduit, receiver };
};

/** Convenience: a conduit with a single started topic-based receiver. */
export let makeTopicReceiverNode = async (
  conduitId: string,
  handleTopic: TopicHandler,
  config?: Partial<ReceiverConfig>
) => {
  let conduit = makeConduit(conduitId);
  let receiver = conduit.createConduitReceiver(handleTopic, config);
  tracked.receivers.push(receiver);
  await receiver.start();
  return { conduit, receiver };
};

/** Convenience: a conduit with a sender (separate process from receivers). */
export let makeSenderNode = (conduitId: string, config?: Partial<SenderConfig>) => {
  let conduit = makeConduit(conduitId);
  let sender = trackSender(conduit.createSender(config));
  return { conduit, sender };
};

/**
 * Tear down everything created during a test, in dependency order: stop
 * receivers (clears intervals + unsubscribes + drops Redis registration),
 * close senders (clears intervals + unsubscribes), then close conduits
 * (closes the underlying NATS connection + Redis client). Errors are swallowed
 * so one wedged resource cannot block cleanup of the rest.
 */
export let cleanupAll = async () => {
  let { receivers, senders, conduits } = tracked;
  tracked = { receivers: [], senders: [], conduits: [] };

  await Promise.allSettled(receivers.map(r => r.stop()));
  await Promise.allSettled(senders.map(s => s.close()));
  await Promise.allSettled(conduits.map(c => c.close()));
};
