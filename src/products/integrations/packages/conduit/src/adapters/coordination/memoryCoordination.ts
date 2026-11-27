import type { ICoordinationAdapter } from './coordinationAdapter';

interface ReceiverEntry {
  receiverId: string;
  expiresAt: number;
}

interface TopicOwnership {
  receiverId: string;
  expiresAt: number;
}

export class MemoryCoordination implements ICoordinationAdapter {
  private receivers: Map<string, ReceiverEntry> = new Map();
  private topicOwners: Map<string, TopicOwnership> = new Map();
  private cleanupInterval: Timer;

  constructor(_conduitId: string = 'default') {
    // Cleanup expired entries every second
    this.cleanupInterval = setInterval(() => this.cleanup(), 1000);
  }

  async registerReceiver(receiverId: string, ttl: number): Promise<void> {
    this.receivers.set(receiverId, {
      receiverId,
      expiresAt: Date.now() + ttl
    });
  }

  async unregisterReceiver(receiverId: string): Promise<void> {
    this.receivers.delete(receiverId);
  }

  async getActiveReceivers(): Promise<string[]> {
    this.cleanup();
    return Array.from(this.receivers.keys());
  }

  async claimTopicOwnership(topic: string, receiverId: string, ttl: number): Promise<boolean> {
    this.cleanup();

    // Check if topic already has an owner
    let existing = this.topicOwners.get(topic);
    if (existing && existing.expiresAt > Date.now()) return false;

    // Claim ownership
    this.topicOwners.set(topic, {
      receiverId,
      expiresAt: Date.now() + ttl
    });

    return true;
  }

  async getTopicOwner(topic: string): Promise<string | null> {
    this.cleanup();
    let ownership = this.topicOwners.get(topic);
    if (!ownership || ownership.expiresAt <= Date.now()) {
      return null;
    }
    return ownership.receiverId;
  }

  async releaseTopicOwnership(topic: string, receiverId: string): Promise<void> {
    let ownership = this.topicOwners.get(topic);
    if (ownership?.receiverId === receiverId) {
      this.topicOwners.delete(topic);
    }
  }

  async renewTopicOwnership(topic: string, receiverId: string, ttl: number): Promise<boolean> {
    let ownership = this.topicOwners.get(topic);
    if (!ownership || ownership.receiverId !== receiverId) {
      return false;
    }

    // Renew ownership
    this.topicOwners.set(topic, {
      receiverId,
      expiresAt: Date.now() + ttl
    });
    return true;
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupInterval);
    this.receivers.clear();
    this.topicOwners.clear();
  }

  private cleanup(): void {
    let now = Date.now();

    // Cleanup expired receivers
    for (let [id, entry] of this.receivers.entries()) {
      if (entry.expiresAt <= now) {
        this.receivers.delete(id);
      }
    }

    // Cleanup expired topic ownership
    for (let [topic, ownership] of this.topicOwners.entries()) {
      if (ownership.expiresAt <= now) {
        this.topicOwners.delete(topic);
      }
    }
  }

  _getAllTopics(): Map<string, TopicOwnership> {
    return new Map(this.topicOwners);
  }

  _forceCleanup(): void {
    this.cleanup();
  }
}
