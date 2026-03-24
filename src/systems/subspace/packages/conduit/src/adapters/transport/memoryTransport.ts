import { getSentry } from '@lowerdeck/sentry';
import type { ITransportAdapter, MessageHandler } from './transportAdapter';

let Sentry = getSentry();

interface Subscription {
  id: string;
  pattern: string;
  handler: MessageHandler;
}

interface PendingRequest {
  resolve: (data: Uint8Array) => void;
  reject: (error: Error) => void;
  timeout: Timer;
}

export class MemoryTransport implements ITransportAdapter {
  private subscriptions: Map<string, Subscription> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private nextSubId = 0;

  async publish(subject: string, data: Uint8Array): Promise<void> {
    // Find matching subscriptions
    let matches = this.findMatchingSubscriptions(subject);

    // Check if this is a reply to a pending request
    if (subject.startsWith('_INBOX.')) {
      let pending = this.pendingRequests.get(subject);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(subject);
        pending.resolve(data);
        return;
      }
    }

    // Deliver to all matching subscribers asynchronously
    for (let sub of matches) {
      // Don't await - fire and forget
      sub.handler(data).catch(err => {
        Sentry.captureException(err);
        console.error(`Error in subscription handler for ${subject}:`, err);
      });
    }
  }

  async request(subject: string, data: Uint8Array, timeout: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      // Generate unique reply subject
      let replySubject = `_INBOX.${crypto.randomUUID()}`;

      // Set up timeout
      let timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(replySubject);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(replySubject, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      // Parse the message to add reply subject
      try {
        let decoder = new TextDecoder();
        let messageStr = decoder.decode(data);
        let message = JSON.parse(messageStr);
        message.replySubject = replySubject;

        // Re-encode with reply subject
        let encoder = new TextEncoder();
        let updatedData = encoder.encode(JSON.stringify(message));

        // Publish request
        this.publish(subject, updatedData).catch(err => {
          clearTimeout(timeoutHandle);
          this.pendingRequests.delete(replySubject);
          reject(err);
        });
      } catch (err) {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(replySubject);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async subscribe(subject: string, handler: MessageHandler): Promise<string> {
    let id = `sub-${this.nextSubId++}`;
    this.subscriptions.set(id, {
      id,
      pattern: subject,
      handler
    });
    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  async close(): Promise<void> {
    // Cancel all pending requests
    for (let [replySubject, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport closed'));
    }
    this.pendingRequests.clear();
    this.subscriptions.clear();
  }

  /**
   * Send a reply to a request (called by receiver)
   * This is a convenience method for MemoryTransport
   */
  async reply(replySubject: string, data: Uint8Array): Promise<void> {
    await this.publish(replySubject, data);
  }

  /**
   * Find subscriptions that match a subject
   * Supports NATS-style wildcards: * (single token) and > (multiple tokens)
   */
  private findMatchingSubscriptions(subject: string): Subscription[] {
    let matches: Subscription[] = [];

    for (let sub of this.subscriptions.values()) {
      if (this.matchesPattern(subject, sub.pattern)) {
        matches.push(sub);
      }
    }

    return matches;
  }

  /**
   * Check if a subject matches a pattern
   * Supports NATS-style wildcards: * (single token) and > (multiple tokens)
   */
  private matchesPattern(subject: string, pattern: string): boolean {
    // Exact match
    if (subject === pattern) {
      return true;
    }

    let subjectTokens = subject.split('.');
    let patternTokens = pattern.split('.');

    let subIdx = 0;
    let patIdx = 0;

    while (patIdx < patternTokens.length) {
      let patToken = patternTokens[patIdx];

      if (patToken === '>') {
        // > matches all remaining tokens
        return true;
      }

      if (subIdx >= subjectTokens.length) {
        return false;
      }

      if (patToken === '*') {
        // * matches exactly one token
        subIdx++;
        patIdx++;
        continue;
      }

      if (patToken === subjectTokens[subIdx]) {
        subIdx++;
        patIdx++;
        continue;
      }

      return false;
    }

    // All pattern tokens matched, check if all subject tokens consumed
    return subIdx === subjectTokens.length;
  }

  /**
   * Test helper: get subscription count
   */
  _getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Test helper: get pending request count
   */
  _getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }
}
