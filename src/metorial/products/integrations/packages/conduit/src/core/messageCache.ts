import type { ConduitResponse } from '../types/response';

interface CacheEntry {
  response: ConduitResponse;
  expiresAt: number;
}

export class MessageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: Timer;

  constructor(
    private maxSize: number,
    private ttl: number
  ) {
    // Cleanup expired entries every 10 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 10000);
  }

  get(messageId: string): ConduitResponse | undefined {
    let entry = this.cache.get(messageId);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(messageId);
      return undefined;
    }

    return entry.response;
  }

  set(messageId: string, response: ConduitResponse): void {
    // Enforce max size (LRU eviction)
    if (this.cache.size >= this.maxSize && !this.cache.has(messageId)) {
      // Remove oldest entry (first in map)
      let firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(messageId, {
      response,
      expiresAt: Date.now() + this.ttl
    });
  }

  has(messageId: string): boolean {
    return this.get(messageId) !== undefined;
  }

  delete(messageId: string): void {
    this.cache.delete(messageId);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    let now = Date.now();
    for (let [messageId, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(messageId);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}
