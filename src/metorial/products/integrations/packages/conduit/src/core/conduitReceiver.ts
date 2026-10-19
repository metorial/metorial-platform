import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';
import type { ITransportAdapter } from '../adapters/transport/transportAdapter';
import type { ReceiverConfig } from '../types/config';
import { ConduitTopicClosedError } from '../types/response';
import type { MessageHandler } from './receiver';
import { Receiver } from './receiver';

export interface TopicContext {
  topic: string;
  extendTtl: (ms: number) => void;
  onMessage: (handler: (data: any) => Promise<unknown> | unknown) => Promise<void>;
  onClose: (handler: () => Promise<void> | void) => Promise<void>;
  close: () => Promise<void>;
}

export type TopicHandler = (ctx: TopicContext) => Promise<void> | void;

export interface ConduitReceiverConfig {
  coordination: ICoordinationAdapter;
  transport: ITransportAdapter;
  conduitId: string;
  handleTopic: TopicHandler;
  config?: Partial<ReceiverConfig>;
}

interface PendingMessage {
  payload: unknown;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface TopicState {
  messageHandler: ((data: unknown) => Promise<unknown> | unknown) | null;
  closeHandlers: Array<() => Promise<void> | void>;
  closed: boolean;
  pendingMessages: PendingMessage[]; // Queue of messages waiting for handler registration
  isProcessingQueue: boolean; // Flag to prevent concurrent queue processing
  onMessagePromise: Promise<void> | null; // Promise that resolves when onMessage completes
  onMessageCalled: boolean; // Flag to track if onMessage was called (even if not awaited)
  ttlExpiresAt: number; // Logical TTL - when this receiver wants to stop handling this topic
}

export class ConduitReceiver {
  private receiver: Receiver;
  private topicHandler: TopicHandler;
  private topicStates: Map<string, TopicState> = new Map();
  private readonly coordination: ICoordinationAdapter;
  private ttlCheckInterval: Timer | null = null;

  constructor(config: ConduitReceiverConfig) {
    this.coordination = config.coordination;
    this.topicHandler = config.handleTopic;

    // Create the underlying receiver with our message handler wrapper
    let messageHandler: MessageHandler = async (topic, payload) => {
      return await this.handleMessage(topic, payload);
    };

    let fullConfig: ReceiverConfig = {
      heartbeatInterval: 5000,
      heartbeatTtl: 10000,
      topicOwnershipTtl: 30000,
      ownershipRenewalInterval: 10000,
      messageCacheTtl: 60000,
      messageCacheSize: 10000,
      timeoutExtensionThreshold: 1000,
      timeoutExtensionMs: 10000,
      maxProcessingMs: 300000,
      maxInFlight: 2000,
      handlerConcurrency: 256,
      maxOrphanedHandlers:
        config.config?.maxOrphanedHandlers ?? config.config?.handlerConcurrency ?? 256,
      ...config.config
    };

    this.receiver = new Receiver(
      config.coordination,
      config.transport,
      fullConfig,
      messageHandler,
      config.conduitId
    );
  }

  async start(): Promise<void> {
    await this.receiver.start();

    // Register callback for ownership loss
    this.receiver.getOwnershipManager().onOwnershipLoss(topic => {
      this.handleOwnershipLoss(topic).catch(err => {
        console.error(`Error handling ownership loss for topic ${topic}:`, err);
      });
    });

    // Start TTL expiration checker (check every 1 second)
    this.ttlCheckInterval = setInterval(() => {
      this.checkTtlExpirations().catch(err => {
        console.error('Error checking TTL expirations:', err);
      });
    }, 1000);
  }

  async stop(): Promise<void> {
    // Stop TTL checker
    if (this.ttlCheckInterval) {
      clearInterval(this.ttlCheckInterval);
      this.ttlCheckInterval = null;
    }

    // Close all topics
    let topics = Array.from(this.topicStates.keys());
    await Promise.all(topics.map(topic => this.closeTopic(topic)));

    // Stop the underlying receiver
    await this.receiver.stop();
  }

  private async handleOwnershipLoss(topic: string): Promise<void> {
    // Close the topic, which will trigger onClose handlers
    await this.closeTopic(topic);
  }

  private async handleMessage(topic: string, payload: unknown): Promise<unknown> {
    let state = this.topicStates.get(topic);

    // If we don't have a state for this topic, initialize it
    if (!state) {
      state = {
        messageHandler: null,
        closeHandlers: [],
        closed: false,
        pendingMessages: [],
        isProcessingQueue: false,
        onMessagePromise: null,
        onMessageCalled: false,
        ttlExpiresAt: Number.POSITIVE_INFINITY // By default, never expire (until extendTtl is called)
      };
      this.topicStates.set(topic, state);
      this.ensureOwnership(topic);

      // Queue this message first
      let messagePromise = new Promise<unknown>((resolve, reject) => {
        state!.pendingMessages.push({ payload, resolve, reject });
      });

      // Call the topic handler to set up the topic
      // This allows the handler to do async setup before registering onMessage
      let setupPromise = (async () => {
        try {
          let ctx = this.createTopicContext(topic, state);
          await this.topicHandler(ctx);

          // The topicHandler might not await onMessage, so we need to wait for the next tick
          // to ensure any non-awaited onMessage calls have a chance to execute
          await new Promise(resolve => setImmediate(resolve));

          // Wait for any pending onMessage registration to complete
          // This ensures processPendingMessages has finished
          if (state.onMessagePromise) {
            await state.onMessagePromise;
          }

          // A topic closed mid-setup has already rejected its pending messages.
          if (state.closed) return;

          // Check if a message handler was registered
          // We check onMessageCalled instead of messageHandler to handle the case where
          // onMessage was called but is still executing asynchronously
          if (!state.onMessageCalled) {
            throw new Error(`No message handler registered for topic ${topic}`);
          }
        } catch (err) {
          if (state.closed) return;

          console.error(`handleTopic failed for topic ${topic}, releasing topic:`, err);

          let error = err instanceof Error ? err : new Error(String(err));
          for (let pending of state.pendingMessages) {
            pending.reject(error);
          }
          state.pendingMessages = [];

          await this.closeTopicState(topic, state);
        }
      })();

      setupPromise.catch(err => {
        console.error(`Error releasing topic ${topic} after failed setup:`, err);
      });

      return messagePromise;
    }

    // If handler is not yet registered, queue the message
    if (!state.messageHandler) {
      return new Promise((resolve, reject) => {
        state!.pendingMessages.push({ payload, resolve, reject });
      });
    }

    // Handler is registered, process immediately
    return await state.messageHandler(payload);
  }

  private createTopicContext(topic: string, state: TopicState): TopicContext {
    return {
      topic,

      extendTtl: (ms: number) => {
        if (state.closed) {
          console.warn(`Cannot extend TTL for closed topic ${topic}`);
          return;
        }

        // Set logical TTL expiration time
        // This is when the receiver wants to voluntarily give up the topic
        state.ttlExpiresAt = Date.now() + ms;
      },

      // Registering on a topic that closed during async setup is expected (TTL expiry,
      // ownership loss), so these calls must not throw: onMessage is a no-op and onClose
      // runs immediately so the caller's cleanup still happens.
      onMessage: async (handler: (data: unknown) => Promise<unknown> | unknown) => {
        if (state.closed) return;

        if (state.messageHandler) {
          throw new Error(`Message handler already registered for topic ${topic}`);
        }

        // Mark that onMessage was called
        state.onMessageCalled = true;
        state.messageHandler = handler;

        // Process all pending messages and store the promise
        state.onMessagePromise = this.processPendingMessages(topic, state);
        await state.onMessagePromise;
      },

      onClose: async (handler: () => Promise<void> | void) => {
        if (state.closed) {
          await this.runCloseHandler(topic, handler);
          return;
        }

        state.closeHandlers.push(handler);
      },

      close: async () => {
        await this.closeTopicState(topic, state);
      }
    };
  }

  private async processPendingMessages(topic: string, state: TopicState): Promise<void> {
    // Prevent concurrent processing
    if (state.isProcessingQueue) {
      return;
    }

    state.isProcessingQueue = true;

    try {
      // Process all pending messages
      while (state.pendingMessages.length > 0) {
        let pending = state.pendingMessages.shift();
        if (!pending) break;

        try {
          if (state.closed) {
            pending.reject(new ConduitTopicClosedError(topic));
            continue;
          }

          if (!state.messageHandler) {
            pending.reject(new Error(`No message handler for topic ${topic}`));
            continue;
          }

          let result = await state.messageHandler(pending.payload);
          pending.resolve(result);
        } catch (err) {
          pending.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    } finally {
      state.isProcessingQueue = false;
    }
  }

  private async checkTtlExpirations(): Promise<void> {
    let now = Date.now();

    for (let [topic, state] of this.topicStates.entries()) {
      if (state.closed) continue;

      // Check if the logical TTL has expired
      if (state.ttlExpiresAt <= now) {
        await this.closeTopicState(topic, state);
      }
    }
  }

  private async closeTopic(topic: string): Promise<void> {
    let state = this.topicStates.get(topic);
    if (state) await this.closeTopicState(topic, state);
  }

  // Closing is bound to a specific state, never to the topic name: once a state is detached,
  // a fresh state for the same topic may start, and stale callbacks (e.g. an old context's
  // close()) must not tear it down. Detaching happens synchronously, before any await, so a
  // message that arrives while close handlers are still running starts that fresh state
  // instead of being rejected.
  private async closeTopicState(topic: string, state: TopicState): Promise<void> {
    if (state.closed) return;

    state.closed = true;

    let ownershipManager = this.receiver.getOwnershipManager();
    if (this.topicStates.get(topic) === state) {
      this.topicStates.delete(topic);
      ownershipManager.removeTopic(topic);
    }

    // These messages never reached a handler, so the sender can safely redeliver them.
    for (let pending of state.pendingMessages) {
      pending.reject(new ConduitTopicClosedError(topic));
    }
    state.pendingMessages = [];

    if (!this.topicStates.has(topic)) {
      try {
        await this.coordination.releaseTopicOwnership(topic, this.receiver.getReceiverId());
      } catch (err) {
        console.error(`Error releasing ownership of closed topic ${topic}:`, err);
      }

      // A replacement state that started during the release may have claimed the key we
      // just deleted; without re-claiming it, the next renewal would treat it as lost.
      if (this.topicStates.has(topic)) this.ensureOwnership(topic);
    }

    for (let handler of state.closeHandlers) {
      await this.runCloseHandler(topic, handler);
    }
  }

  // A fresh state can start from a message that was received (and tracked) before the
  // previous state's close dropped the topic and released its lease, so it must re-register
  // locally and re-claim the lease if it is gone. Claims are NX, so this is a no-op when the
  // lease is still ours; if another receiver holds it, renewal reports the loss and closes us.
  private ensureOwnership(topic: string): void {
    let ownershipManager = this.receiver.getOwnershipManager();
    ownershipManager.addTopic(topic);

    ownershipManager.claimTopic(topic).catch(err => {
      console.error(`Error claiming ownership of topic ${topic}:`, err);
    });
  }

  private async runCloseHandler(
    topic: string,
    handler: () => Promise<void> | void
  ): Promise<void> {
    try {
      await handler();
    } catch (err) {
      console.error(`Error in close handler for topic ${topic}:`, err);
    }
  }

  getReceiverId(): string {
    return this.receiver.getReceiverId();
  }

  getOwnedTopicCount(): number {
    return this.receiver.getOwnedTopicCount();
  }

  getOwnedTopics(): string[] {
    return this.receiver.getOwnedTopics();
  }

  isRunning(): boolean {
    return this.receiver.isRunning();
  }

  isHealthy(): boolean {
    return this.receiver.isHealthy();
  }

  isReady(): boolean {
    return this.receiver.isReady();
  }

  async isRegistered(): Promise<boolean> {
    let activeReceivers = await this.coordination.getActiveReceivers();
    return activeReceivers.includes(this.receiver.getReceiverId());
  }

  getStats() {
    return this.receiver.getStats();
  }

  getHandledTopics(): string[] {
    return Array.from(this.topicStates.keys()).filter(topic => {
      let state = this.topicStates.get(topic);
      return state && !state.closed;
    });
  }
}

export let createConduitReceiver = (config: ConduitReceiverConfig) =>
  new ConduitReceiver(config);
