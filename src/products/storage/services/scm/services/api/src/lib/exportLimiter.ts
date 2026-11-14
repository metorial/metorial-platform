import { Redis } from 'ioredis';
import type {
  ScmBackend,
  ScmInstallation,
  ScmRepository
} from '../../prisma/generated/client';
import { env } from '../env';

let MIN_GRANT = 5;
let CONCURRENCY_RETRY_MS = 15_000;
let CONCURRENCY_RETRY_JITTER_MS = 10_000;
let KEY_TTL_MS = 2 * 60 * 60_000;

// KEYS: active leases (zset holder -> expiry), minute bucket, hour bucket.
// Buckets refill continuously; a missing bucket starts full.
let acquireScript = `
local now = tonumber(ARGV[1])
local holder = ARGV[2]
local leaseMs = tonumber(ARGV[3])
local maxConcurrent = tonumber(ARGV[4])
local want = tonumber(ARGV[5])
local minGrant = tonumber(ARGV[6])
local minuteCap = tonumber(ARGV[7])
local hourCap = tonumber(ARGV[8])
local keyTtl = tonumber(ARGV[9])

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if not redis.call('ZSCORE', KEYS[1], holder) and redis.call('ZCARD', KEYS[1]) >= maxConcurrent then
  return {0, 0}
end

local function level(key, capacity, periodMs)
  local state = redis.call('HMGET', key, 'tokens', 'ts')
  local tokens = tonumber(state[1]) or capacity
  local ts = tonumber(state[2]) or now
  if now > ts then tokens = math.min(capacity, tokens + (now - ts) * capacity / periodMs) end
  return tokens
end

local minuteTokens = level(KEYS[2], minuteCap, 60000)
local hourTokens = level(KEYS[3], hourCap, 3600000)
local grant = math.min(want, math.floor(math.min(minuteTokens, hourTokens)))

if grant < minGrant then
  local waitMinute = math.max(0, (minGrant - minuteTokens) * 60000 / minuteCap)
  local waitHour = math.max(0, (minGrant - hourTokens) * 3600000 / hourCap)
  return {0, math.ceil(math.max(waitMinute, waitHour, 1))}
end

redis.call('HSET', KEYS[2], 'tokens', tostring(minuteTokens - grant), 'ts', tostring(now))
redis.call('HSET', KEYS[3], 'tokens', tostring(hourTokens - grant), 'ts', tostring(now))
redis.call('PEXPIRE', KEYS[2], keyTtl)
redis.call('PEXPIRE', KEYS[3], keyTtl)
redis.call('ZADD', KEYS[1], now + leaseMs, holder)
redis.call('PEXPIRE', KEYS[1], math.max(keyTtl, leaseMs))
return {1, grant}
`;

// A negative adjustment debits writes a slice made beyond its grant (a single file can cost
// more than the whole budget), so the buckets may go below zero until they refill.
let releaseScript = `
local now = tonumber(ARGV[1])
local holder = ARGV[2]
local adjust = tonumber(ARGV[3])
local minuteCap = tonumber(ARGV[4])
local hourCap = tonumber(ARGV[5])
local keyTtl = tonumber(ARGV[6])

redis.call('ZREM', KEYS[1], holder)
if adjust == 0 then return 0 end

local function settle(key, capacity, periodMs)
  local state = redis.call('HMGET', key, 'tokens', 'ts')
  local tokens = tonumber(state[1]) or capacity
  local ts = tonumber(state[2]) or now
  if now > ts then tokens = tokens + (now - ts) * capacity / periodMs end
  redis.call('HSET', key, 'tokens', tostring(math.min(capacity, tokens + adjust)), 'ts', tostring(now))
  redis.call('PEXPIRE', key, keyTtl)
end

settle(KEYS[2], minuteCap, 60000)
settle(KEYS[3], hourCap, 3600000)
return adjust
`;

export type ExportLimiterAccount = {
  key: string;
  writesPerMinute: number;
  writesPerHour: number;
};

export type ExportLimiterGrant =
  | { granted: true; tokens: number }
  | { granted: false; reason: 'concurrency' | 'tokens'; retryAt: Date };

let getHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export let getExportLimiterAccount = (
  repo: ScmRepository & { installation: ScmInstallation & { backend: ScmBackend } }
): ExportLimiterAccount => {
  let settings = env.manifestSync;
  let host = getHost(repo.installation.backend.apiUrl);

  if (repo.provider === 'github') {
    return {
      key: `github:${host}:${repo.installation.externalInstallationId}`,
      writesPerMinute: settings.ORIGIN_GITHUB_WRITES_PER_MINUTE,
      writesPerHour: settings.ORIGIN_GITHUB_WRITES_PER_HOUR
    };
  }

  if (repo.provider === 'gitlab') {
    return {
      key: `gitlab:${host}:${repo.installation.externalAccountId}`,
      writesPerMinute: settings.ORIGIN_GITLAB_WRITES_PER_MINUTE,
      writesPerHour: settings.ORIGIN_GITLAB_WRITES_PER_HOUR
    };
  }

  let owner =
    repo.installation.backend.type === 'bitbucket_data_center'
      ? repo.installation.externalAccountId
      : repo.externalOwner;
  return {
    key: `bitbucket:${host}:${owner}`,
    writesPerMinute: settings.ORIGIN_BITBUCKET_WRITES_PER_MINUTE,
    writesPerHour: settings.ORIGIN_BITBUCKET_WRITES_PER_HOUR
  };
};

export let createExportLimiter = (d: {
  redis: () => Redis;
  prefix: string;
  maxConcurrent: () => number;
  now?: () => number;
}) => {
  let now = d.now ?? (() => Date.now());
  let keys = (account: ExportLimiterAccount) => [
    `${d.prefix}:{${account.key}}:active`,
    `${d.prefix}:{${account.key}}:minute`,
    `${d.prefix}:{${account.key}}:hour`
  ];

  return {
    acquire: async (i: {
      account: ExportLimiterAccount;
      holder: string;
      want: number;
      leaseMs: number;
    }): Promise<ExportLimiterGrant> => {
      let at = now();
      let minGrant = Math.max(
        1,
        Math.min(i.want, i.account.writesPerMinute, i.account.writesPerHour, MIN_GRANT)
      );
      let [granted, value] = (await d
        .redis()
        .eval(
          acquireScript,
          3,
          ...keys(i.account),
          at,
          i.holder,
          i.leaseMs,
          d.maxConcurrent(),
          i.want,
          minGrant,
          i.account.writesPerMinute,
          i.account.writesPerHour,
          KEY_TTL_MS
        )) as [number, number];

      if (granted === 1) return { granted: true, tokens: value };
      if (value === 0) {
        return {
          granted: false,
          reason: 'concurrency',
          retryAt: new Date(
            at + CONCURRENCY_RETRY_MS + Math.floor(Math.random() * CONCURRENCY_RETRY_JITTER_MS)
          )
        };
      }
      return { granted: false, reason: 'tokens', retryAt: new Date(at + value) };
    },

    release: async (i: {
      account: ExportLimiterAccount;
      holder: string;
      granted: number;
      used: number;
    }) => {
      await d
        .redis()
        .eval(
          releaseScript,
          3,
          ...keys(i.account),
          now(),
          i.holder,
          Math.trunc(i.granted - Math.max(0, i.used)),
          i.account.writesPerMinute,
          i.account.writesPerHour,
          KEY_TTL_MS
        );
    }
  };
};

export type ExportLimiter = ReturnType<typeof createExportLimiter>;

let redis: Redis | undefined;

export let exportLimiter = createExportLimiter({
  redis: () => (redis ??= new Redis(env.service.REDIS_URL, { maxRetriesPerRequest: 3 })),
  prefix: 'origin:export-limiter',
  maxConcurrent: () => env.manifestSync.ORIGIN_EXPORT_MAX_CONCURRENT_PER_ACCOUNT
});
