import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';
import type { MemoryTransport } from '../adapters/transport/memoryTransport';
import type { ITransportAdapter } from '../adapters/transport/transportAdapter';
import type { ReceiverConfig } from '../types/config';
import type { ConduitMessage, TimeoutExtension } from '../types/message';
import type { ConduitResponse } from '../types/response';
import { MessageCache } from './messageCache';
import { OwnershipManager } from './ownershipManager';

let Sentry = getSentry();

export type MessageHandler = (topic: string, payload: unknown) => Promise<unknown>;

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
  private readonly conduitId: string;
  private processingMessages: Map<string, ProcessingMessage> = new Map();
  private timeoutCheckInterval: Timer | null = null;

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
    this.ownershipManager = new OwnershipManager(
      this.receiverId,
      coordination,
      config.ownershipRenewalInterval,
      config.topicOwnershipTtl
    );
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

    // Register receiver
    await this.coordination.registerReceiver(this.receiverId, this.config.heartbeatTtl);
    console.log(
      `CONDUIT.receiver.start.registered receiverId=${this.receiverId} heartbeatTtl=${this.config.heartbeatTtl}`
    );

    // Start heartbeat
    this.startHeartbeat();

    // Start ownership renewal
    this.ownershipManager.start();

    // Start shared timeout check interval
    this.startTimeoutChecker();

    // Subscribe to messages
    await this.subscribe();
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

    // Clear processing messages
    this.processingMessages.clear();
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
    try {
      // Decode message
      let decoder = new TextDecoder();
      let messageStr = decoder.decode(data);
      let message: ConduitMessage = serialize.decode(messageStr);

      // Check if we've seen this message before
      let cachedResponse = this.messageCache.get(message.messageId);
      if (cachedResponse) {
        // Return cached response
        await this.sendResponse(message, cachedResponse);
        return;
      }

      // Add topic to ownership (we're processing it now)
      this.ownershipManager.addTopic(message.topic);

      // Process message
      let response = await this.processMessage(message);

      // Cache the response
      this.messageCache.set(message.messageId, response);

      // Send response
      await this.sendResponse(message, response);
    } catch (err) {
      Sentry.captureException(err);
      console.error('CONDUIT.receiver.handleMessage.error receiverId=' + this.receiverId, err);
      // If we can't even parse/decode, we can't respond
    }
  }

  private async processMessage(message: ConduitMessage): Promise<ConduitResponse> {
    try {
      // Track message for timeout extension monitoring
      const now = Date.now();
      this.processingMessages.set(message.messageId, {
        message,
        startTime: now,
        lastExtensionSentAt: 0, // No extension sent yet
        currentDeadline: now + message.timeout
      });

      // Call user handler
      let result = await this.handler(message.topic, message.payload);

      let elapsed = Date.now() - now;

      // Remove from tracking
      this.processingMessages.delete(message.messageId);

      // Create success response
      return {
        messageId: message.messageId,
        success: true,
        result,
        processedAt: Date.now()
      };
    } catch (err) {
      Sentry.captureException(err);

      // Remove from tracking
      this.processingMessages.delete(message.messageId);

      let error = err instanceof Error ? err : new Error(String(err));

      console.error(
        `CONDUIT.receiver.processMessage.error receiverId=${this.receiverId} messageId=${message.messageId} topic=${message.topic}:`,
        error
      );

      // Create error response
      return {
        messageId: message.messageId,
        success: false,
        error: error.message,
        processedAt: Date.now()
      };
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

      // If we're getting close to deadline and haven't sent extension recently, send it
      // Allow unlimited extensions, but rate-limit them (at least 1 second between extensions)
      const timeSinceLastExtension = now - processing.lastExtensionSentAt;
      const shouldSendExtension =
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
    // await this.broadcastTopicResponse(message, response);
  }

  // private async broadcastTopicResponse(
  //   message: ConduitMessage,
  //   response: ConduitResponse
  // ): Promise<void> {
  //   try {
  //     let broadcast: TopicResponseBroadcast = {
  //       topic: message.topic,
  //       messageId: message.messageId,
  //       response,
  //       receiverId: this.receiverId,
  //       broadcastAt: Date.now()
  //     };

  //     let encoder = new TextEncoder();
  //     let data = encoder.encode(serialize.encode(broadcast));
  //     let subject = `conduit.${this.conduitId}.topic.responses.${message.topic}`;

  //     await this.transport.publish(subject, data);
  //   } catch (err) {
  //     // Don't fail the response if broadcast fails
  //     console.error(`Error broadcasting topic response for ${message.topic}:`, err);
  //   }
  // }

  private isMemoryTransport(): boolean {
    return 'reply' in this.transport;
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
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
