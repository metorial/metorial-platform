import { getSentry } from '@lowerdeck/sentry';
import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';

let Sentry = getSentry();

export type OwnershipLossCallback = (topic: string) => void;

export class OwnershipManager {
  private ownedTopics: Set<string> = new Set();
  private topicTtls: Map<string, number> = new Map(); // Per-topic TTLs
  private renewalInterval: Timer | null = null;
  private ownershipLossCallbacks: OwnershipLossCallback[] = [];

  constructor(
    private receiverId: string,
    private coordination: ICoordinationAdapter,
    private renewalIntervalMs: number,
    private ownershipTtl: number
  ) {}

  start(): void {
    if (this.renewalInterval) {
      return;
    }

    this.renewalInterval = setInterval(() => {
      this.renewOwnerships().catch(err => {
        Sentry.captureException(err);
        console.error('Error renewing ownerships:', err);
      });
    }, this.renewalIntervalMs);
  }

  stop(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
    }
  }

  addTopic(topic: string, ttl?: number): void {
    this.ownedTopics.add(topic);
    if (ttl !== undefined) {
      this.topicTtls.set(topic, ttl);
    }
  }

  removeTopic(topic: string): void {
    this.ownedTopics.delete(topic);
    this.topicTtls.delete(topic);
  }

  onOwnershipLoss(callback: OwnershipLossCallback): void {
    this.ownershipLossCallbacks.push(callback);
  }

  ownsTopic(topic: string): boolean {
    return this.ownedTopics.has(topic);
  }

  getOwnedTopics(): string[] {
    return Array.from(this.ownedTopics);
  }

  async releaseAll(): Promise<void> {
    let releases = Array.from(this.ownedTopics).map(topic =>
      this.coordination.releaseTopicOwnership(topic, this.receiverId).catch(err => {
        console.error(`Error releasing ownership of ${topic}:`, err);
      })
    );

    await Promise.all(releases);
    this.ownedTopics.clear();
  }

  private async renewOwnerships(): Promise<void> {
    let renewals = Array.from(this.ownedTopics).map(async topic => {
      try {
        // Use per-topic TTL if available, otherwise use default
        const ttl = this.topicTtls.get(topic) ?? this.ownershipTtl;

        let renewed = await this.coordination.renewTopicOwnership(topic, this.receiverId, ttl);

        // If renewal failed, we lost ownership
        if (!renewed) {
          console.warn(`Lost ownership of topic ${topic}, removing from owned set`);
          this.ownedTopics.delete(topic);
          this.topicTtls.delete(topic);

          // Notify callbacks
          this.notifyOwnershipLoss(topic);
        }
      } catch (err) {
        console.error(`Error renewing ownership of ${topic}:`, err);
        // Don't remove from set on error - might be transient
      }
    });

    await Promise.all(renewals);
  }

  private notifyOwnershipLoss(topic: string): void {
    for (const callback of this.ownershipLossCallbacks) {
      try {
        callback(topic);
      } catch (err) {
        Sentry.captureException(err);
        console.error(`Error in ownership loss callback for topic ${topic}:`, err);
      }
    }
  }

  getOwnedCount(): number {
    return this.ownedTopics.size;
  }
}
