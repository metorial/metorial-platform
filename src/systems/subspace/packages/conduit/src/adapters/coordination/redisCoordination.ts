import { getSentry } from '@lowerdeck/sentry';
import Redis from 'ioredis';
import type { RedisConfig } from '../../types/config';
import type { ICoordinationAdapter } from './coordinationAdapter';

let Sentry = getSentry();

/**
 * Redis-based coordination adapter for production use
 * Optimized for high-throughput scenarios with caching and efficient data structures
 */
export class RedisCoordination implements ICoordinationAdapter {
  private redis: Redis;
  private readonly keyPrefix: string;
  private scriptShas: Map<string, string> = new Map();
  private receiversCache: { receivers: string[]; expiresAt: number } | null = null;
  private cleanupInterval?: NodeJS.Timer;
  private readonly CACHE_TTL = 1000; // 1 second cache

  constructor(config: RedisConfig, conduitId: string = 'default') {
    console.log('Connecting to Redis for coordination...');

    this.redis = new Redis({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      db: config.db ?? 0,
      tls: config.tls,
      retryStrategy: (times: number) => Math.min(times * 50, 3000),

      // Connection optimization
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      keepAlive: 30000
    });
    this.redis.on('connect', () => {});
    this.redis.on('error', err => {
      console.error(
        `CONDUIT.redis.error host=${config.host} port=${config.port} error=${err.message}`
      );
    });
    this.redis.on('close', () => {
      console.log(`CONDUIT.redis.closed host=${config.host} port=${config.port}`);
    });

    this.keyPrefix = `conduit:${conduitId}:`;

    // Start background cleanup every 30 seconds
    this.cleanupInterval = setInterval(
      () =>
        this.cleanupExpiredReceivers().catch(err => {
          Sentry.captureException(err);
          console.error('Error in background cleanup:', err);
        }),
      30000
    );
  }

  async registerReceiver(receiverId: string, ttl: number): Promise<void> {
    let key = this.receiverKey(receiverId);
    let ttlSeconds = Math.ceil(ttl / 1000);
    let expiryTime = Date.now() + ttl;

    // Atomic operation: set key and add to sorted set
    let script = `
      redis.call("setex", KEYS[1], ARGV[1], "alive")
      redis.call("zadd", KEYS[2], ARGV[2], ARGV[3])
      return 1
    `;

    await this.evalScript(
      script,
      2,
      key,
      this.receiverZSetKey(),
      ttlSeconds,
      expiryTime,
      receiverId
    );

    // Invalidate cache
    this.receiversCache = null;
  }

  async unregisterReceiver(receiverId: string): Promise<void> {
    let key = this.receiverKey(receiverId);

    let pipeline = this.redis.pipeline();
    pipeline.del(key);
    pipeline.zrem(this.receiverZSetKey(), receiverId);
    await pipeline.exec();

    // Invalidate cache
    this.receiversCache = null;
  }

  async getActiveReceivers(): Promise<string[]> {
    // Check cache first
    if (this.receiversCache && Date.now() < this.receiversCache.expiresAt) {
      return this.receiversCache.receivers;
    }

    let now = Date.now();
    let pipeline = this.redis.pipeline();

    // Remove expired receivers atomically
    pipeline.zremrangebyscore(this.receiverZSetKey(), '-inf', now);

    // Get remaining active receivers
    pipeline.zrangebyscore(this.receiverZSetKey(), now, '+inf');

    let results = await pipeline.exec();
    let receivers = (results?.[1]?.[1] as string[]) || [];

    // Store in cache
    this.receiversCache = {
      receivers,
      expiresAt: Date.now() + this.CACHE_TTL
    };

    return receivers;
  }

  async claimTopicOwnership(topic: string, receiverId: string, ttl: number): Promise<boolean> {
    let key = this.topicOwnerKey(topic);
    let ttlSeconds = Math.ceil(ttl / 1000);

    // SET key value EX ttl NX
    // Returns OK if successful, null if key already exists
    let result = await this.redis.set(key, receiverId, 'EX', ttlSeconds, 'NX');

    return result === 'OK';
  }

  async getTopicOwner(topic: string): Promise<string | null> {
    let key = this.topicOwnerKey(topic);
    return await this.redis.get(key);
  }

  async releaseTopicOwnership(topic: string, receiverId: string): Promise<void> {
    let key = this.topicOwnerKey(topic);

    // Only delete if we're still the owner (atomic check-and-delete)
    let script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.evalScript(script, 1, key, receiverId);
  }

  async renewTopicOwnership(topic: string, receiverId: string, ttl: number): Promise<boolean> {
    let key = this.topicOwnerKey(topic);
    let ttlSeconds = Math.ceil(ttl / 1000);

    // Only extend TTL if we're still the owner (atomic check-and-extend)
    let script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        redis.call("expire", KEYS[1], ARGV[2])
        return 1
      else
        return 0
      end
    `;

    let result = await this.evalScript(script, 1, key, receiverId, ttlSeconds);

    return result === 1;
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.redis.quit();
  }

  private async evalScript(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<any> {
    let sha = this.scriptShas.get(script);

    if (!sha) {
      // Load script and cache SHA
      sha = (await this.redis.script('LOAD', script)) as any;
      this.scriptShas.set(script, sha!);
    }

    try {
      return await this.redis.evalsha(sha!, numKeys, ...args);
    } catch (err: any) {
      if (err.message?.includes('NOSCRIPT')) {
        // Script not in Redis cache, reload it
        sha = (await this.redis.script('LOAD', script)) as any;
        this.scriptShas.set(script, sha!);
        return await this.redis.evalsha(sha!, numKeys, ...args);
      }

      throw err;
    }
  }

  private async cleanupExpiredReceivers(): Promise<void> {
    let now = Date.now();
    let removed = await this.redis.zremrangebyscore(this.receiverZSetKey(), '-inf', now);

    if (removed > 0) {
      // Invalidate cache after cleanup
      this.receiversCache = null;
    }
  }

  private receiverKey(receiverId: string): string {
    return `${this.keyPrefix}receiver:${receiverId}`;
  }

  private receiverZSetKey(): string {
    return `${this.keyPrefix}receivers_zset`;
  }

  private topicOwnerKey(topic: string): string {
    return `${this.keyPrefix}topic_owner:${topic}`;
  }
}
