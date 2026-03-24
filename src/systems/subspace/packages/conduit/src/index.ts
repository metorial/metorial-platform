// Core components

// Adapters - Interfaces
export type { ICoordinationAdapter } from './adapters/coordination/coordinationAdapter';
// Adapters - Implementations
export { MemoryCoordination } from './adapters/coordination/memoryCoordination';
export { RedisCoordination } from './adapters/coordination/redisCoordination';
export { MemoryTransport } from './adapters/transport/memoryTransport';
export { NatsTransport } from './adapters/transport/natsTransport';
export type {
  ITransportAdapter,
  MessageHandler as TransportMessageHandler
} from './adapters/transport/transportAdapter';
export { ConduitReceiver, createConduitReceiver } from './core/conduitReceiver';
export type {
  ConduitReceiverConfig,
  TopicContext,
  TopicHandler
} from './core/conduitReceiver';
export { MessageCache } from './core/messageCache';
export { OwnershipManager } from './core/ownershipManager';
export type { OwnershipLossCallback } from './core/ownershipManager';
export { Receiver } from './core/receiver';
export type { MessageHandler } from './core/receiver';
export { RetryManager } from './core/retryManager';
export { Sender } from './core/sender';

// Imports for factory function
import { MemoryCoordination } from './adapters/coordination/memoryCoordination';
import { RedisCoordination } from './adapters/coordination/redisCoordination';
import { MemoryTransport } from './adapters/transport/memoryTransport';
import { NatsTransport } from './adapters/transport/natsTransport';
import { createConduitReceiver, type TopicHandler } from './core/conduitReceiver';
import { type MessageHandler, Receiver } from './core/receiver';
import { Sender } from './core/sender';
import type { NatsConfig, ReceiverConfig, RedisConfig, SenderConfig } from './types/config';

export type {
  ConduitConfig,
  CoordinationConfig,
  NatsConfig,
  ReceiverConfig,
  RedisConfig,
  SenderConfig,
  TransportConfig
} from './types/config';
// Types
export { DEFAULT_CONFIG, mergeConfig } from './types/config';
export { isTimeoutExtension } from './types/message';
export type { ConduitMessage, TimeoutExtension } from './types/message';
export { ConduitProcessError, ConduitSendError } from './types/response';
export type { ConduitResponse } from './types/response';
export type {
  TopicListener,
  TopicResponseBroadcast,
  TopicSubscription
} from './types/topicListener';

let getSenderConfig = (config?: Partial<SenderConfig>): SenderConfig => ({
  defaultTimeout: 5000,
  maxRetries: 20,
  retryBackoffMs: 100,
  retryBackoffMultiplier: 2,
  inFlightCacheTtl: 20000,
  maxInFlightMessages: 1000,
  ...config
});

let getReceiverConfig = (config?: Partial<ReceiverConfig>): ReceiverConfig => ({
  heartbeatInterval: 2000,
  heartbeatTtl: 10000,
  topicOwnershipTtl: 10000,
  ownershipRenewalInterval: 4000,
  messageCacheTtl: 60000,
  messageCacheSize: 10000,
  timeoutExtensionThreshold: 1000,
  ...config
});

export let createMemoryConduit = (conduitId: string = 'default') => {
  let coordination = new MemoryCoordination(conduitId);
  let transport = new MemoryTransport();

  return {
    conduitId,
    coordination,
    transport
  };
};

export let createRedisNatsConduit = (opts: {
  conduitId: string;
  redisConfig: RedisConfig;
  natsConfig: NatsConfig;
}) => {
  let coordination = new RedisCoordination(opts.redisConfig, opts.conduitId);
  let transport = new NatsTransport(opts.natsConfig);

  return {
    conduitId: opts.conduitId,
    coordination,
    transport
  };
};

export type Adapter =
  | ReturnType<typeof createMemoryConduit>
  | ReturnType<typeof createRedisNatsConduit>;

export let createConduit = (adapter: Adapter = createMemoryConduit()) => {
  let { conduitId, coordination, transport } = adapter;

  return {
    coordination,
    transport,
    createSender: (config?: Partial<SenderConfig>) =>
      new Sender(coordination, transport, getSenderConfig(config), conduitId),
    createReceiver: (handler: MessageHandler, config?: Partial<ReceiverConfig>) =>
      new Receiver(coordination, transport, getReceiverConfig(config), handler, conduitId),
    createConduitReceiver: (handleTopic: TopicHandler, config?: Partial<ReceiverConfig>) =>
      createConduitReceiver({
        coordination,
        transport,
        conduitId,
        handleTopic,
        config: getReceiverConfig(config)
      }),
    close: async () => {
      await coordination.close();
      await transport.close();
    }
  };
};
