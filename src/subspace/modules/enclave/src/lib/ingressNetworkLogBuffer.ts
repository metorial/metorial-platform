import { RedisClient } from 'bun';
import { Buffer } from 'node:buffer';

export type BufferedIngressNetworkLogResult = 'allowed' | 'denied';

export type BufferedIngressNetworkLogDimensions = {
  tenantOid: bigint;
  environmentOid: bigint;
  solutionOid: number;
  enclaveOid: bigint;
  sessionId: string | null;
  sourceIp: string;
  hostname: string;
  port: number;
  result: BufferedIngressNetworkLogResult;
  bucketStart: string;
};

export type BufferedIngressNetworkLogEntry = BufferedIngressNetworkLogDimensions & {
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

type SerializedIngressNetworkLogDimensions = Omit<
  BufferedIngressNetworkLogDimensions,
  'tenantOid' | 'environmentOid' | 'enclaveOid'
> & {
  tenantOid: string;
  environmentOid: string;
  enclaveOid: string;
};

let PENDING_COUNTS_KEY = 'sub:enc:ingressNetworkLog:pending:counts';
let PENDING_META_KEY = 'sub:enc:ingressNetworkLog:pending:meta';
let PENDING_FIRST_SEEN_KEY = 'sub:enc:ingressNetworkLog:pending:firstSeen';
let PENDING_LAST_SEEN_KEY = 'sub:enc:ingressNetworkLog:pending:lastSeen';
let SNAPSHOT_TTL_SECONDS = 60 * 60;
let THIRTY_MINUTES_MS = 30 * 60 * 1000;

let buffer = new Map<string, BufferedIngressNetworkLogEntry>();
let redis: RedisClient | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;

let getBucketStart = (date: Date) =>
  new Date(Math.floor(date.getTime() / THIRTY_MINUTES_MS) * THIRTY_MINUTES_MS);

let getRedisUrl = () => process.env.REDIS_URL;

let getRedis = () => {
  if (redis) return redis;

  let redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  redis = new RedisClient(redisUrl.replace('rediss://', 'redis://'), {
    tls: redisUrl.startsWith('rediss://')
  });

  return redis;
};

let serializeDimensions = (
  dimensions: BufferedIngressNetworkLogDimensions
): SerializedIngressNetworkLogDimensions => ({
  tenantOid: dimensions.tenantOid.toString(),
  environmentOid: dimensions.environmentOid.toString(),
  solutionOid: dimensions.solutionOid,
  enclaveOid: dimensions.enclaveOid.toString(),
  sessionId: dimensions.sessionId,
  sourceIp: dimensions.sourceIp,
  hostname: dimensions.hostname,
  port: dimensions.port,
  result: dimensions.result,
  bucketStart: dimensions.bucketStart
});

let deserializeDimensions = (
  dimensions: SerializedIngressNetworkLogDimensions
): BufferedIngressNetworkLogDimensions => ({
  ...dimensions,
  tenantOid: BigInt(dimensions.tenantOid),
  environmentOid: BigInt(dimensions.environmentOid),
  enclaveOid: BigInt(dimensions.enclaveOid)
});

let encodeDimensions = (dimensions: BufferedIngressNetworkLogDimensions) =>
  Buffer.from(JSON.stringify(serializeDimensions(dimensions))).toString('base64url');

let decodeDimensions = (key: string) =>
  deserializeDimensions(JSON.parse(Buffer.from(key, 'base64url').toString('utf8')));

let mergeIntoBuffer = (entry: BufferedIngressNetworkLogEntry) => {
  let key = encodeDimensions(entry);
  let existing = buffer.get(key);

  if (!existing) {
    buffer.set(key, entry);
    return;
  }

  existing.count += entry.count;
  if (entry.firstSeenAt < existing.firstSeenAt) existing.firstSeenAt = entry.firstSeenAt;
  if (entry.lastSeenAt > existing.lastSeenAt) existing.lastSeenAt = entry.lastSeenAt;
};

export let recordIngressNetworkLog = (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  solutionOid: number;
  enclaveOid: bigint;
  sessionId?: string | null;
  sourceIp: string;
  hostname: string;
  port: number;
  result: BufferedIngressNetworkLogResult;
  at?: Date;
}) => {
  let seenAt = d.at ?? new Date();
  let dimensions: BufferedIngressNetworkLogDimensions = {
    tenantOid: d.tenantOid,
    environmentOid: d.environmentOid,
    solutionOid: d.solutionOid,
    enclaveOid: d.enclaveOid,
    sessionId: d.sessionId ?? null,
    sourceIp: d.sourceIp,
    hostname: d.hostname,
    port: d.port,
    result: d.result,
    bucketStart: getBucketStart(seenAt).toISOString()
  };

  mergeIntoBuffer({
    ...dimensions,
    count: 1,
    firstSeenAt: seenAt.toISOString(),
    lastSeenAt: seenAt.toISOString()
  });
};

let setEarlierDate = async (redis: RedisClient, key: string, field: string, value: string) => {
  let existing = await redis.hget(key, field);
  if (!existing || value < existing) await redis.hset(key, field, value);
};

let setLaterDate = async (redis: RedisClient, key: string, field: string, value: string) => {
  let existing = await redis.hget(key, field);
  if (!existing || value > existing) await redis.hset(key, field, value);
};

export let flushBufferedIngressNetworkLogsToRedis = async () => {
  if (buffer.size === 0) return;

  let redis = getRedis();
  if (!redis) return;

  let entries = [...buffer.entries()];
  buffer.clear();

  try {
    for (let [key, entry] of entries) {
      await redis.hincrby(PENDING_COUNTS_KEY, key, entry.count);
      await redis.hset(PENDING_META_KEY, key, JSON.stringify(serializeDimensions(entry)));
      await setEarlierDate(redis, PENDING_FIRST_SEEN_KEY, key, entry.firstSeenAt);
      await setLaterDate(redis, PENDING_LAST_SEEN_KEY, key, entry.lastSeenAt);
    }

    await Promise.all([
      redis.expire(PENDING_COUNTS_KEY, SNAPSHOT_TTL_SECONDS),
      redis.expire(PENDING_META_KEY, SNAPSHOT_TTL_SECONDS),
      redis.expire(PENDING_FIRST_SEEN_KEY, SNAPSHOT_TTL_SECONDS),
      redis.expire(PENDING_LAST_SEEN_KEY, SNAPSHOT_TTL_SECONDS)
    ]);
  } catch (error) {
    for (let [, entry] of entries) mergeIntoBuffer(entry);
    throw error;
  }
};

let getSnapshotKey = (baseKey: string, snapshotId: string) =>
  `${baseKey}:snapshot:${snapshotId}`;

let renameIfExists = async (redis: RedisClient, from: string, to: string) => {
  if (!(await redis.exists(from))) return false;
  await redis.rename(from, to);
  await redis.expire(to, SNAPSHOT_TTL_SECONDS);
  return true;
};

export let snapshotPendingIngressNetworkLogs = async () => {
  let redis = getRedis();
  if (!redis) return null;

  let snapshotId = `${Date.now()}`;
  let countsKey = getSnapshotKey(PENDING_COUNTS_KEY, snapshotId);

  let hasCounts = await renameIfExists(redis, PENDING_COUNTS_KEY, countsKey);
  if (!hasCounts) return null;

  await renameIfExists(redis, PENDING_META_KEY, getSnapshotKey(PENDING_META_KEY, snapshotId));
  await renameIfExists(
    redis,
    PENDING_FIRST_SEEN_KEY,
    getSnapshotKey(PENDING_FIRST_SEEN_KEY, snapshotId)
  );
  await renameIfExists(
    redis,
    PENDING_LAST_SEEN_KEY,
    getSnapshotKey(PENDING_LAST_SEEN_KEY, snapshotId)
  );

  return {
    snapshotId,
    fields: await redis.hkeys(countsKey)
  };
};

export let getIngressNetworkLogSnapshotEntry = async (d: {
  snapshotId: string;
  field: string;
}): Promise<BufferedIngressNetworkLogEntry | null> => {
  let redis = getRedis();
  if (!redis) return null;

  let [count, meta, firstSeenAt, lastSeenAt] = await Promise.all([
    redis.hget(getSnapshotKey(PENDING_COUNTS_KEY, d.snapshotId), d.field),
    redis.hget(getSnapshotKey(PENDING_META_KEY, d.snapshotId), d.field),
    redis.hget(getSnapshotKey(PENDING_FIRST_SEEN_KEY, d.snapshotId), d.field),
    redis.hget(getSnapshotKey(PENDING_LAST_SEEN_KEY, d.snapshotId), d.field)
  ]);

  if (!count) return null;

  let dimensions = meta
    ? deserializeDimensions(JSON.parse(meta))
    : decodeDimensions(d.field);

  return {
    ...dimensions,
    count: Number(count),
    firstSeenAt: firstSeenAt ?? dimensions.bucketStart,
    lastSeenAt: lastSeenAt ?? dimensions.bucketStart
  };
};

export let deleteIngressNetworkLogSnapshotEntry = async (d: {
  snapshotId: string;
  field: string;
}) => {
  let redis = getRedis();
  if (!redis) return;

  await Promise.all([
    redis.hdel(getSnapshotKey(PENDING_COUNTS_KEY, d.snapshotId), d.field),
    redis.hdel(getSnapshotKey(PENDING_META_KEY, d.snapshotId), d.field),
    redis.hdel(getSnapshotKey(PENDING_FIRST_SEEN_KEY, d.snapshotId), d.field),
    redis.hdel(getSnapshotKey(PENDING_LAST_SEEN_KEY, d.snapshotId), d.field)
  ]);
};

let startFlushTimer = () => {
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    flushBufferedIngressNetworkLogsToRedis().catch(error => {
      console.error('Failed to flush ingress network logs to Redis', error);
    });
  }, 60 * 1000);
  flushTimer.unref?.();
};

startFlushTimer();
