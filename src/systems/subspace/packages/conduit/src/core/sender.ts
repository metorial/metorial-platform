import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';
import type { ITransportAdapter } from '../adapters/transport/transportAdapter';
import type { SenderConfig } from '../types/config';
import type { ConduitMessage, TimeoutExtension } from '../types/message';
import { isTimeoutExtension } from '../types/message';
import type { ConduitResponse } from '../types/response';
import { ConduitSendError } from '../types/response';
import type {
  TopicListener,
  TopicResponseBroadcast,
  TopicSubscription
} from '../types/topicListener';
import { RetryManager } from './retryManager';

let Sentry = getSentry();

interface InFlightMessage {
  resolve: (response: ConduitResponse) => void;
  reject: (error: Error) => void;
  timeout: Timer;
  currentTimeout: number;
  messageId: string;
  subscriptionId?: string;
}

export class Sender {
  private senderId: string;
  private retryManager: RetryManager;
  private messageCounter = 0;
  private inFlightMessages: Map<string, InFlightMessage> = new Map();
  private topicSubscriptions: Map<string, string> = new Map(); // topic -> subscriptionId
  private readonly conduitId: string;
  private failedUnsubscribes: Set<string> = new Set(); // Track failed unsubscribes
  private cleanupInterval: Timer | null = null;

  constructor(
    private coordination: ICoordinationAdapter,
    private transport: ITransportAdapter,
    private config: SenderConfig,
    conduitId: string = 'default'
  ) {
    this.conduitId = conduitId;
    this.senderId = `sender-${crypto.randomUUID()}`;
    this.retryManager = new RetryManager(
      config.maxRetries,
      config.retryBackoffMs,
      config.retryBackoffMultiplier
    );

    // Start cleanup interval for failed unsubscribes
    this.cleanupInterval = setInterval(() => {
      this.retryFailedUnsubscribes().catch(err => {
        console.error('Error retrying failed unsubscribes:', err);
      });
    }, 30000); // Retry every 30 seconds
  }

  async send(topic: string, payload: unknown, timeout?: number): Promise<ConduitResponse> {
    // Check max in-flight limit
    if (this.inFlightMessages.size >= this.config.maxInFlightMessages) {
      throw new ConduitSendError(
        `Max in-flight messages limit reached (${this.config.maxInFlightMessages}). Cannot send new message.`,
        'N/A',
        topic,
        0
      );
    }

    let actualTimeout = timeout ?? this.config.defaultTimeout;
    let messageId = this.generateMessageId();

    return this.retryManager.withRetry(async attemptNumber => {
      let message: ConduitMessage = {
        messageId,
        topic,
        payload,
        replySubject: '', // Will be set by transport
        timeout: actualTimeout,
        sentAt: Date.now(),
        retryCount: attemptNumber
      };

      return await this.sendMessage(message, actualTimeout);
    }, `Send message ${messageId} to topic ${topic}`);
  }

  async subscribeTopic(topic: string, listener: TopicListener): Promise<TopicSubscription> {
    // Check if already subscribed
    if (this.topicSubscriptions.has(topic)) {
      throw new Error(`Already subscribed to topic: ${topic}`);
    }

    // Subscribe to topic response channel
    let subject = `conduit.${this.conduitId}.topic.responses.${topic}`;

    let subscriptionId = await this.transport.subscribe(subject, async (data: Uint8Array) => {
      try {
        let decoder = new TextDecoder();
        let broadcastStr = decoder.decode(data);
        let broadcast: TopicResponseBroadcast = serialize.decode(broadcastStr);

        // Call listener (don't await to avoid blocking)
        Promise.resolve(listener(broadcast)).catch(err => {
          console.error(`Error in topic listener for ${topic}:`, err);
        });
      } catch (err) {
        Sentry.captureException(err);
        console.error(`Error parsing topic broadcast for ${topic}:`, err);
      }
    });

    this.topicSubscriptions.set(topic, subscriptionId);

    return {
      topic,
      unsubscribe: async () => {
        await this.unsubscribeTopic(topic);
      }
    };
  }

  async unsubscribeTopic(topic: string): Promise<void> {
    let subscriptionId = this.topicSubscriptions.get(topic);
    if (!subscriptionId) {
      return;
    }

    await this.transport.unsubscribe(subscriptionId);
    this.topicSubscriptions.delete(topic);
  }

  getSubscribedTopics(): string[] {
    return Array.from(this.topicSubscriptions.keys());
  }

  async close(): Promise<void> {
    console.log(
      `CONDUIT.sender.close senderId=${this.senderId} inFlight=${this.inFlightMessages.size} topicSubscriptions=${this.topicSubscriptions.size} failedUnsubscribes=${this.failedUnsubscribes.size}`
    );

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Cancel all in-flight messages
    for (let [messageId, inFlight] of this.inFlightMessages.entries()) {
      console.log(
        `CONDUIT.sender.close.cancel_in_flight senderId=${this.senderId} messageId=${messageId}`
      );
      clearTimeout(inFlight.timeout);
      inFlight.reject(new Error('Sender closed'));
      this.inFlightMessages.delete(messageId);
    }

    // Unsubscribe from all topics
    let topics = Array.from(this.topicSubscriptions.keys());
    for (let topic of topics) {
      await this.unsubscribeTopic(topic);
    }

    // Final attempt to clean up failed unsubscribes
    await this.retryFailedUnsubscribes();
    console.log(`CONDUIT.sender.close.done senderId=${this.senderId}`);
  }

  private async safeUnsubscribe(subscriptionId: string): Promise<void> {
    try {
      await this.transport.unsubscribe(subscriptionId);
      // Successfully unsubscribed, remove from failed set if it was there
      this.failedUnsubscribes.delete(subscriptionId);
    } catch (err) {
      Sentry.captureException(err);
      console.warn(`Failed to unsubscribe ${subscriptionId}, will retry later:`, err);
      this.failedUnsubscribes.add(subscriptionId);
      throw err;
    }
  }

  private async retryFailedUnsubscribes(): Promise<void> {
    if (this.failedUnsubscribes.size === 0) {
      return;
    }

    let toRetry = Array.from(this.failedUnsubscribes);
    for (let subscriptionId of toRetry) {
      try {
        await this.transport.unsubscribe(subscriptionId);
        this.failedUnsubscribes.delete(subscriptionId);
      } catch (err) {
        Sentry.captureException(err);
        // Still failing, keep in set for next retry
        console.warn(`Retry unsubscribe failed for ${subscriptionId}:`, err);
      }
    }
  }

  private async sendMessage(
    message: ConduitMessage,
    timeout: number
  ): Promise<ConduitResponse> {
    // Resolve topic owner
    let receiverId = await this.resolveOwner(message.topic);
    if (!receiverId) {
      throw new ConduitSendError(
        `No receiver available for topic ${message.topic}`,
        message.messageId,
        message.topic,
        message.retryCount
      );
    }

    // Publish to receiver-specific subject
    let subject = `conduit.${this.conduitId}.receiver.${receiverId}.${message.topic}`;

    return new Promise<ConduitResponse>((resolve, reject) => {
      let currentTimeout = timeout;

      // Set up timeout
      let timeoutHandle = setTimeout(() => {
        let inFlight = this.inFlightMessages.get(message.messageId);
        this.inFlightMessages.delete(message.messageId);
        // Clean up subscription
        if (inFlight?.subscriptionId) {
          this.safeUnsubscribe(inFlight.subscriptionId).catch(() => {});
        }
        reject(
          new ConduitSendError(
            `Request timeout after ${currentTimeout}ms`,
            message.messageId,
            message.topic,
            message.retryCount
          )
        );
      }, currentTimeout);

      // Store in-flight message (will be updated with subscriptionId later)
      this.inFlightMessages.set(message.messageId, {
        resolve: (response: ConduitResponse) => {
          clearTimeout(timeoutHandle);
          let inFlight = this.inFlightMessages.get(message.messageId);
          this.inFlightMessages.delete(message.messageId);
          // Clean up subscription
          if (inFlight?.subscriptionId) {
            this.safeUnsubscribe(inFlight.subscriptionId).catch(() => {});
          }
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutHandle);
          let inFlight = this.inFlightMessages.get(message.messageId);
          this.inFlightMessages.delete(message.messageId);
          // Clean up subscription
          if (inFlight?.subscriptionId) {
            this.safeUnsubscribe(inFlight.subscriptionId).catch(() => {});
          }
          reject(error);
        },
        timeout: timeoutHandle,
        currentTimeout,
        messageId: message.messageId
      });

      // Generate a unique reply subject and subscribe to it
      let replySubject = `_INBOX.${crypto.randomUUID()}`;

      // Set up response handler by subscribing to reply subject
      let subscriptionPromise = this.transport.subscribe(
        replySubject,
        async (responseData: Uint8Array) => {
          try {
            let decoder = new TextDecoder();
            let responseStr = decoder.decode(responseData);
            let response = serialize.decode(responseStr) as ConduitResponse | TimeoutExtension;

            // Check if it's a timeout extension
            if (isTimeoutExtension(response)) {
              this.handleTimeoutExtension(response);
              return; // Continue waiting for actual response
            }

            // It's the final response - resolve and cleanup
            let inFlight = this.inFlightMessages.get(message.messageId);
            if (inFlight) {
              inFlight.resolve(response as ConduitResponse);
            } else {
            }
          } catch (err) {
            let inFlight = this.inFlightMessages.get(message.messageId);
            if (inFlight) {
              inFlight.reject(
                new ConduitSendError(
                  `Response parsing error: ${err instanceof Error ? err.message : String(err)}`,
                  message.messageId,
                  message.topic,
                  message.retryCount,
                  err instanceof Error ? err : new Error(String(err))
                )
              );
            }
          }
        }
      );

      // After subscription is set up, send the message
      subscriptionPromise
        .then(subscriptionId => {
          // Store subscription ID for cleanup
          let inFlight = this.inFlightMessages.get(message.messageId);
          if (inFlight) {
            inFlight.subscriptionId = subscriptionId;
          }

          // Add reply subject to message
          let messageWithReply = { ...message, replySubject };

          // Encode and send message
          let encoder = new TextEncoder();
          let data = encoder.encode(serialize.encode(messageWithReply));

          return this.transport.publish(subject, data).catch(err => {
            // Clean up subscription
            this.safeUnsubscribe(subscriptionId).catch(() => {});

            let inFlight = this.inFlightMessages.get(message.messageId);
            if (inFlight) {
              inFlight.reject(
                new ConduitSendError(
                  `Transport error: ${err.message}`,
                  message.messageId,
                  message.topic,
                  message.retryCount,
                  err
                )
              );
            }
          });
        })
        .catch(err => {
          let inFlight = this.inFlightMessages.get(message.messageId);
          if (inFlight) {
            inFlight.reject(
              new ConduitSendError(
                `Subscription error: ${err.message}`,
                message.messageId,
                message.topic,
                message.retryCount,
                err
              )
            );
          }
        });
    });
  }

  private async resolveOwner(topic: string): Promise<string | null> {
    // Check if topic has an owner
    let owner = await this.coordination.getTopicOwner(topic);
    if (owner) {
      return owner;
    }

    // No owner, need to assign one
    let receivers = await this.coordination.getActiveReceivers();
    if (receivers.length === 0) {
      return null;
    }

    // Pick a random receiver
    let randomReceiver = receivers[Math.floor(Math.random() * receivers.length)];
    if (!randomReceiver) {
      return null;
    }

    // Try to claim ownership
    let claimed = await this.coordination.claimTopicOwnership(
      topic,
      randomReceiver,
      30000 // 30 second TTL
    );

    if (claimed) {
      return randomReceiver;
    }

    // Someone else claimed it, get the winner
    owner = await this.coordination.getTopicOwner(topic);
    return owner;
  }

  private handleTimeoutExtension(extension: TimeoutExtension): void {
    let inFlight = this.inFlightMessages.get(extension.messageId);
    if (!inFlight) {
      return;
    }

    // Clear old timeout
    clearTimeout(inFlight.timeout);

    // Set new timeout with extended time
    let newTimeout = extension.extensionMs;
    inFlight.currentTimeout = newTimeout;
    inFlight.timeout = setTimeout(() => {
      this.inFlightMessages.delete(extension.messageId);
      inFlight.reject(
        new ConduitSendError(
          `Request timeout after extension (${newTimeout}ms)`,
          extension.messageId,
          '',
          0
        )
      );
    }, newTimeout);
  }

  private generateMessageId(): string {
    return `${this.senderId}:${Date.now()}:${this.messageCounter++}`;
  }

  getSenderId(): string {
    return this.senderId;
  }

  getInFlightCount(): number {
    return this.inFlightMessages.size;
  }
}
