import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';
import type { MemoryTransport } from '../adapters/transport/memoryTransport';
import type { ITransportAdapter } from '../adapters/transport/transportAdapter';
import type { ReceiverConfig } from '../types/config';
import type { ConduitMessage, TimeoutExtension } from '../types/message';
import type { ConduitResponse } from '../types/response';
import type { TopicResponseBroadcast } from '../types/topicListener';
import { CONDUIT_HEALTH_TOPIC, type ConduitHealthPong } from './health';
import { MessageCache } from './messageCache';
import { OwnershipManager } from './ownershipManager';
import { Semaphore } from './semaphore';

let Sentry = getSentry();

export type MessageHandler = (topic: string, payload: unknown) => Promise<unknown>;

const STUCK_GRACE_MS = 30000;

class HandlerCeilingError extends Error {
  constructor(public readonly limitMs: number) {
    super(`handler exceeded max processing time (${limitMs}ms)`);
    this.name = 'HandlerCeilingError';
  }
}

interface ProcessingMessage {
  message: ConduitMessage;
  startTime: number;
  lastExtensionSentAt: number; // Timestamp of last extension
  currentDeadline: number; // Current timeout deadline
}

export class Receiver {
  private receiverId: string;
  private messageCache: MessageCache;
  private ownershipManager: OwnershipManager;
  private heartbeatInterval: Timer | null = null;
  private subscriptionId: string | null = null;
  private running = false;
  private ready = false;
  private readonly conduitId: string;
  private processingMessages: Map<string, ProcessingMessage> = new Map();
  private timeoutCheckInterval: Timer | null = null;

  // Per-topic FIFO chains: same-topic messages run in arrival order, different
  // topics run concurrently. Removes cross-session head-of-line blocking while
  // preserving per-session ordering.
  private topicChains: Map<string, Promise<void>> = new Map();
  // Messages currently queued/executing, keyed by messageId, for in-flight
  // dedup (a sender retry reuses the same messageId).
  private inFlightById: Map<string, Promise<ConduitResponse>> = new Map();
  private handlerSemaphore: Semaphore;
  private lastProgressAt = Date.now();
  private lastHealthy = true;

  // Observability counters.
  private dispatchedCount = 0;
  private shedCount = 0;
  private ceilingAbortCount = 0;
  private dedupHitCount = 0;
  private healthTick = 0;

  constructor(
    private coordination: ICoordinationAdapter,
    private transport: ITransportAdapter,
    private config: ReceiverConfig,
    private handler: MessageHandler,
    conduitId: string = 'default'
  ) {
    this.conduitId = conduitId;
    this.receiverId = `receiver-${crypto.randomUUID()}`;
    this.messageCache = new MessageCache(config.messageCacheSize, config.messageCacheTtl);
    this.handlerSemaphore = new Semaphore(config.handlerConcurrency);
    this.ownershipManager = new OwnershipManager(
      this.receiverId,
      coordination,
      config.ownershipRenewalInterval,
      config.topicOwnershipTtl
    );
    // Stop renewing ownership when unhealthy so topics get reassigned.
    this.ownershipManager.setHealthCheck(() => this.isHealthy());
  }

  async start(): Promise<void> {
    if (this.running) {
      console.log(`CONDUIT.receiver.start already_running receiverId=${this.receiverId}`);
      return;
    }

    this.running = true;
    console.log(
      `CONDUIT.receiver.start receiverId=${this.receiverId} conduitId=${this.conduitId}`
    );

    // Subscribe to messages FIRST. We must be listening before we advertise
    // ourselves as an active receiver, otherwise a freshly-started worker would
    // be in the active pool (and pingable / assignable) while not yet draining.
    await this.subscribe();
    this.ready = true;

    // Now register the receiver (only after we are actually listening).
    await this.coordination.registerReceiver(this.receiverId, this.config.heartbeatTtl);
    console.log(
      `CONDUIT.receiver.start.registered receiverId=${this.receiverId} heartbeatTtl=${this.config.heartbeatTtl}`
    );

    // Start heartbeat
    this.startHeartbeat();

    // Start ownership renewal
    this.ownershipManager.start();

    // Start shared timeout/health check interval
    this.startTimeoutChecker();

    console.log(`CONDUIT.receiver.start.done receiverId=${this.receiverId}`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      console.log(`CONDUIT.receiver.stop not_running receiverId=${this.receiverId}`);
      return;
    }

    console.log(
      `CONDUIT.receiver.stop receiverId=${this.receiverId} processingMessages=${this.processingMessages.size}`
    );
    this.running = false;
    this.ready = false;

    // Stop heartbeat
    this.stopHeartbeat();

    // Stop timeout checker
    this.stopTimeoutChecker();

    // Stop ownership renewal
    this.ownershipManager.stop();

    // Release all owned topics
    await this.ownershipManager.releaseAll();

    // Unsubscribe
    if (this.subscriptionId) {
      await this.transport.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    // Unregister receiver
    await this.coordination.unregisterReceiver(this.receiverId);

    // Cleanup cache
    this.messageCache.destroy();

    // Clear processing/in-flight state
    this.processingMessages.clear();
    this.inFlightById.clear();
    this.topicChains.clear();
    console.log(`CONDUIT.receiver.stop.done receiverId=${this.receiverId}`);
  }

  private async subscribe(): Promise<void> {
    // Subscribe to conduit.{conduitId}.receiver.{receiverId}.>
    let subject = `conduit.${this.conduitId}.receiver.${this.receiverId}.>`;

    this.subscriptionId = await this.transport.subscribe(subject, async (data: Uint8Array) => {
      await this.handleMessage(data);
    });
  }

  private async handleMessage(data: Uint8Array): Promise<void> {
    let message: ConduitMessage;
    try {
      let decoder = new TextDecoder();
      let messageStr = decoder.decode(data);
      message = serialize.decode(messageStr);
    } catch (err) {
      Sentry.captureException(err);
      console.error(
        'CONDUIT.receiver.handleMessage.decode_error receiverId=' + this.receiverId,
        err
      );
      // If we can't even parse/decode, we can't respond.
      return;
    }

    // Dispatch happened: the read loop is alive and handed us a message.
    this.lastProgressAt = Date.now();
    this.dispatchedCount++;

    // Reserved health topic: answer directly so a successful pong proves this
    // receiver's read loop is draining. Bypasses the user handler and the
    // per-topic queue so it is never blocked behind a slow topic.
    if (message.topic === CONDUIT_HEALTH_TOPIC) {
      await this.sendHealthPong(message).catch(err => {
        console.error('CONDUIT.receiver.health_pong.error receiverId=' + this.receiverId, err);
      });
      return;
    }

    try {
      // Already-completed response (post-completion dedup).
      let cachedResponse = this.messageCache.get(message.messageId);
      if (cachedResponse) {
        await this.sendResponse(message, cachedResponse);
        return;
      }

      // In-flight dedup: a retry of a message we are still processing must NOT
      // run the handler twice. Attach to the existing in-flight promise and
      // re-send its response to this retry's reply subject.
      let inFlight = this.inFlightById.get(message.messageId);
      if (inFlight) {
        this.dedupHitCount++;
        try {
          let response = await inFlight;
          await this.sendResponse(message, response);
        } catch (err) {
          Sentry.captureException(err);
        }
        return;
      }

      // Backpressure: shed when over the in-flight cap so memory stays bounded.
      // Respond with failure so the sender fails/retries fast rather than hanging.
      if (this.inFlightById.size >= this.config.maxInFlight) {
        this.shedCount++;
        console.warn(
          `CONDUIT.receiver.shed receiverId=${this.receiverId} messageId=${message.messageId} topic=${message.topic} inFlight=${this.inFlightById.size} maxInFlight=${this.config.maxInFlight} totalShed=${this.shedCount}`
        );
        await this.sendResponse(message, {
          messageId: message.messageId,
          success: false,
          error: 'receiver overloaded (in-flight cap exceeded)',
          processedAt: Date.now()
        }).catch(() => {});
        return;
      }

      // Add topic to ownership (we're processing it now).
      this.ownershipManager.addTopic(message.topic);

      // Run on the per-topic FIFO chain (serial within topic, concurrent across
      // topics), and register as in-flight for dedup.
      let resultPromise = this.runOnTopic(message.topic, () => this.processMessage(message));
      this.inFlightById.set(message.messageId, resultPromise);

      let response: ConduitResponse;
      try {
        response = await resultPromise;
      } catch (err) {
        // processMessage is designed not to throw, but guard regardless.
        Sentry.captureException(err);
        let error = err instanceof Error ? err : new Error(String(err));
        response = {
          messageId: message.messageId,
          success: false,
          error: error.message,
          processedAt: Date.now()
        };
      } finally {
        this.inFlightById.delete(message.messageId);
      }

      // Cache the response and reply.
      this.messageCache.set(message.messageId, response);
      await this.sendResponse(message, response);
    } catch (err) {
      Sentry.captureException(err);
      console.error('CONDUIT.receiver.handleMessage.error receiverId=' + this.receiverId, err);
    }
  }

  private runOnTopic<T>(topic: string, fn: () => Promise<T>): Promise<T> {
    let prev = this.topicChains.get(topic) ?? Promise.resolve();
    let result = prev.then(fn, fn);
    let chain = result.then(
      () => {},
      () => {}
    );
    this.topicChains.set(topic, chain);
    chain.then(() => {
      // Clean up only if no newer work was chained after us.
      if (this.topicChains.get(topic) === chain) {
        this.topicChains.delete(topic);
      }
    });
    return result;
  }

  private async processMessage(message: ConduitMessage): Promise<ConduitResponse> {
    // Bound the number of handlers executing concurrently (does not block the
    // transport read loop - we are already off it here).
    await this.handlerSemaphore.acquire();

    const now = Date.now();
    this.processingMessages.set(message.messageId, {
      message,
      startTime: now,
      lastExtensionSentAt: 0,
      currentDeadline: now + message.timeout
    });

    let ceilingTimer: Timer | undefined;

    try {
      // Race the handler against a hard ceiling so a never-returning provider
      // call cannot hold this slot forever.
      let ceiling = new Promise<never>((_, reject) => {
        ceilingTimer = setTimeout(
          () => reject(new HandlerCeilingError(this.config.maxProcessingMs)),
          this.config.maxProcessingMs
        );
      });

      let result = await Promise.race([this.handler(message.topic, message.payload), ceiling]);

      return {
        messageId: message.messageId,
        success: true,
        result,
        processedAt: Date.now()
      };
    } catch (err) {
      if (err instanceof HandlerCeilingError) {
        this.ceilingAbortCount++;
        Sentry.captureException(err);
        console.error(
          `CONDUIT.receiver.processMessage.ceiling receiverId=${this.receiverId} messageId=${message.messageId} topic=${message.topic} maxProcessingMs=${this.config.maxProcessingMs} totalCeilingAborts=${this.ceilingAbortCount}`
        );
        return {
          messageId: message.messageId,
          success: false,
          error: 'handler exceeded max processing time',
          processedAt: Date.now()
        };
      }

      Sentry.captureException(err);
      let error = err instanceof Error ? err : new Error(String(err));
      console.error(
        `CONDUIT.receiver.processMessage.error receiverId=${this.receiverId} messageId=${message.messageId} topic=${message.topic}:`,
        error
      );
      return {
        messageId: message.messageId,
        success: false,
        error: error.message,
        processedAt: Date.now()
      };
    } finally {
      if (ceilingTimer) clearTimeout(ceilingTimer);
      this.processingMessages.delete(message.messageId);
      this.lastProgressAt = Date.now();
      this.handlerSemaphore.release();
    }
  }

  private async sendHealthPong(message: ConduitMessage): Promise<void> {
    let pong: ConduitHealthPong = {
      type: 'conduit.health.pong',
      receiverId: this.receiverId,
      at: Date.now()
    };
    let response: ConduitResponse = {
      messageId: message.messageId,
      success: true,
      result: pong,
      processedAt: Date.now()
    };

    let encoder = new TextEncoder();
    let data = encoder.encode(serialize.encode(response));

    if (this.isMemoryTransport()) {
      await (this.transport as MemoryTransport).reply(message.replySubject, data);
    } else {
      await this.transport.publish(message.replySubject, data);
    }
  }

  private startTimeoutChecker(): void {
    if (this.timeoutCheckInterval) {
      return;
    }

    // Check all processing messages every second (much less frequent than 500ms per message)
    this.timeoutCheckInterval = setInterval(() => {
      this.checkTimeouts().catch(err => {
        console.error('Error checking timeouts:', err);
      });
      this.evaluateHealth();
    }, 1000);
  }

  private stopTimeoutChecker(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
  }

  private async checkTimeouts(): Promise<void> {
    let now = Date.now();
    let threshold = this.config.timeoutExtensionThreshold;

    for (let [messageId, processing] of this.processingMessages.entries()) {
      let remaining = processing.currentDeadline - now;

      // Cap extensions at the hard processing ceiling: once a message has been
      // running for maxProcessingMs it will be aborted by processMessage, so we
      // stop extending its deadline instead of allowing unlimited extensions.
      const reachedCeiling = now - processing.startTime >= this.config.maxProcessingMs;

      // If we're getting close to deadline and haven't sent extension recently, send it.
      // Rate-limit extensions (at least 1 second between them).
      const timeSinceLastExtension = now - processing.lastExtensionSentAt;
      const shouldSendExtension =
        !reachedCeiling &&
        remaining < threshold &&
        remaining > 0 &&
        (processing.lastExtensionSentAt === 0 || timeSinceLastExtension >= 1000);

      if (shouldSendExtension) {
        const extensionMs = 10000; // Request 10 more seconds
        let extension: TimeoutExtension = {
          messageId: processing.message.messageId,
          extensionMs,
          type: 'timeout_extension'
        };

        // Update tracking before sending to avoid race conditions
        processing.lastExtensionSentAt = now;
        processing.currentDeadline = now + extensionMs;

        this.sendExtension(processing.message, extension).catch(err => {
          console.error('Error sending timeout extension:', err);
        });
      }
    }
  }

  private async sendExtension(
    message: ConduitMessage,
    extension: TimeoutExtension
  ): Promise<void> {
    let encoder = new TextEncoder();
    let data = encoder.encode(serialize.encode(extension));

    // For MemoryTransport, we need special handling
    if (this.isMemoryTransport()) {
      await (this.transport as MemoryTransport).reply(message.replySubject, data);
    } else {
      // For NATS, publish to reply subject
      await this.transport.publish(message.replySubject, data);
    }
  }

  private async sendResponse(
    message: ConduitMessage,
    response: ConduitResponse
  ): Promise<void> {
    let encoder = new TextEncoder();
    let data = encoder.encode(serialize.encode(response));

    // Send direct reply to sender
    if (this.isMemoryTransport()) {
      await (this.transport as MemoryTransport).reply(message.replySubject, data);
    } else {
      // For NATS, publish to reply subject
      await this.transport.publish(message.replySubject, data);
    }

    // Broadcast response to topic listeners
    await this.broadcastTopicResponse(message, response);
  }

  private async broadcastTopicResponse(
    message: ConduitMessage,
    response: ConduitResponse
  ): Promise<void> {
    try {
      let broadcast: TopicResponseBroadcast = {
        topic: message.topic,
        messageId: message.messageId,
        response,
        receiverId: this.receiverId,
        broadcastAt: Date.now()
      };

      let encoder = new TextEncoder();
      let data = encoder.encode(serialize.encode(broadcast));
      let subject = `conduit.${this.conduitId}.topic.responses.${message.topic}`;

      await this.transport.publish(subject, data);
    } catch (err) {
      // Don't fail the response if broadcast fails
      console.error(`Error broadcasting topic response for ${message.topic}:`, err);
    }
  }

  private isMemoryTransport(): boolean {
    return 'reply' in this.transport;
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      // Gate the Redis heartbeat on health: a wedged receiver stops renewing so
      // its TTL expires and it drops out of the active pool, letting senders
      // reassign its topics to a healthy receiver (recovery without a restart).
      if (!this.isHealthy()) {
        console.warn(
          `CONDUIT.receiver.heartbeat_skipped_unhealthy receiverId=${this.receiverId}`
        );
        return;
      }

      this.coordination
        .registerReceiver(this.receiverId, this.config.heartbeatTtl)
        .catch(err => {
          Sentry.captureException(err);
          console.error('Error sending heartbeat:', err);
        });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  isHealthy(): boolean {
    if (!this.running) return false;
    // Still starting up (subscribing): nothing to be unhealthy about yet.
    if (!this.ready) return true;

    let now = Date.now();
    let limit = this.config.maxProcessingMs + STUCK_GRACE_MS;
    for (let processing of this.processingMessages.values()) {
      if (now - processing.startTime > limit) {
        return false;
      }
    }
    return true;
  }

  private evaluateHealth(): void {
    let healthy = this.isHealthy();
    if (healthy !== this.lastHealthy) {
      this.lastHealthy = healthy;
      console.warn(
        `CONDUIT.receiver.health_flip receiverId=${this.receiverId} healthy=${healthy} inFlight=${this.inFlightById.size} activeTopics=${this.topicChains.size} processing=${this.processingMessages.size} sinceProgressMs=${Date.now() - this.lastProgressAt}`
      );
    }

    // Periodic stats log (every ~30s) while there is work in flight, so the
    // next incident is diagnosable from logs alone.
    this.healthTick++;
    if (this.healthTick % 30 === 0 && this.inFlightById.size > 0) {
      let s = this.getStats();
      console.log(
        `CONDUIT.receiver.stats receiverId=${this.receiverId} healthy=${healthy} inFlight=${s.inFlight} activeTopics=${s.activeTopics} processing=${s.processing} slotsAvail=${s.handlerSlotsAvailable} waiting=${s.handlerWaiting} dispatched=${s.dispatched} shed=${s.shed} ceilingAborts=${s.ceilingAborts} dedupHits=${s.dedupHits} sinceProgressMs=${Date.now() - s.lastProgressAt}`
      );
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getStats(): {
    inFlight: number;
    activeTopics: number;
    processing: number;
    handlerSlotsAvailable: number;
    handlerWaiting: number;
    lastProgressAt: number;
    dispatched: number;
    shed: number;
    ceilingAborts: number;
    dedupHits: number;
  } {
    return {
      inFlight: this.inFlightById.size,
      activeTopics: this.topicChains.size,
      processing: this.processingMessages.size,
      handlerSlotsAvailable: this.handlerSemaphore.getAvailable(),
      handlerWaiting: this.handlerSemaphore.getWaiting(),
      lastProgressAt: this.lastProgressAt,
      dispatched: this.dispatchedCount,
      shed: this.shedCount,
      ceilingAborts: this.ceilingAbortCount,
      dedupHits: this.dedupHitCount
    };
  }

  getReceiverId(): string {
    return this.receiverId;
  }

  getOwnedTopicCount(): number {
    return this.ownershipManager.getOwnedCount();
  }

  getOwnedTopics(): string[] {
    return this.ownershipManager.getOwnedTopics();
  }

  isRunning(): boolean {
    return this.running;
  }

  getOwnershipManager(): OwnershipManager {
    return this.ownershipManager;
  }
}
