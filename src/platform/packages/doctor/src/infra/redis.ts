import { check, probes, type CheckDefinition } from '@lowerdeck/doctor';
import { attempt } from '../resolutions';

let minimumMajorVersion = 7;
let memoryWarnRatio = 0.85;

export interface RedisLike {
  ping: () => Promise<unknown>;
  info: (section: string) => Promise<string>;
}

export let parseRedisInfo = (text: string) => {
  let values: Record<string, string> = {};

  for (let line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;

    let index = line.indexOf(':');
    if (index > 0) values[line.slice(0, index)] = line.slice(index + 1).trim();
  }

  return values;
};

type BunRedisClient = {
  ping: () => Promise<unknown>;
  send: (command: string, args: string[]) => Promise<unknown>;
};

export let bunRedis = (
  clientOrUrl: BunRedisClient | string | undefined = process.env.REDIS_URL
): RedisLike => {
  let client =
    typeof clientOrUrl == 'object'
      ? clientOrUrl
      : new Bun.RedisClient(clientOrUrl?.replace('rediss://', 'redis://'), {
          tls: clientOrUrl?.startsWith('rediss://')
        });

  return {
    ping: () => client.ping(),
    info: async section => String(await client.send('INFO', [section]))
  };
};

export let redisChecks = (options: {
  client: RedisLike;
  name?: string;
}): CheckDefinition[] => {
  let target = `redis/${options.name ?? 'default'}`;
  let base = { category: 'cache' as const, target, dependsOn: ['redis.connect'] };
  let info = async (section: string) => parseRedisInfo(await options.client.info(section));
  let connect = probes.redis({ client: options.client });

  return [
    check({
      id: 'redis.connect',
      title: 'Redis is reachable',
      category: 'cache',
      severity: 'critical',
      target,
      run: ctx => attempt(ctx, 'redis', () => connect(ctx))
    }),

    check({
      ...base,
      id: 'redis.version',
      title: 'Redis runs version 7 or newer',
      severity: 'critical',
      run: ctx =>
        attempt(ctx, 'redis', async () => {
          let server = await info('server');
          let version = server.valkey_version ?? server.redis_version ?? '';
          let major = Number(version.split('.')[0]);
          let details = { version, valkey: Boolean(server.valkey_version) };

          if (!Number.isFinite(major) || major < minimumMajorVersion) {
            return ctx.fail({
              message: `Redis ${version || '(unknown)'} is too old; Metorial needs 7 or newer.`,
              resolution: { summary: 'Upgrade to Redis 7+ or Valkey 7+.' },
              details
            });
          }

          return ctx.pass(`Version ${version}.`, details);
        })
    }),

    check({
      ...base,
      id: 'redis.eviction-policy',
      title: 'Redis never evicts keys',
      severity: 'critical',
      run: ctx =>
        attempt(ctx, 'redis', async () => {
          let policy = (await info('memory')).maxmemory_policy;
          if (!policy || policy == 'noeviction')
            return ctx.pass('maxmemory-policy is noeviction.');

          return ctx.fail({
            message: `maxmemory-policy is ${policy}: Redis can silently drop queued jobs.`,
            resolution: {
              summary: 'Set maxmemory-policy to noeviction.',
              steps: [
                'Self-managed: CONFIG SET maxmemory-policy noeviction, and persist it in redis.conf.',
                'Managed services: change the parameter group (ElastiCache) or the server configuration.'
              ],
              docs: 'datacenter/operations/doctor#redis'
            },
            details: { policy }
          });
        })
    }),

    check({
      ...base,
      id: 'redis.cluster-mode',
      title: 'Redis cluster mode is off',
      severity: 'critical',
      run: ctx =>
        attempt(ctx, 'redis', async () => {
          let enabled = (await info('cluster')).cluster_enabled;
          if (enabled != '1') return ctx.pass('Cluster mode is off.');

          return ctx.fail({
            message: 'Redis runs in cluster mode, which Metorial does not support.',
            resolution: { summary: 'Use a Redis deployment with cluster mode disabled.' }
          });
        })
    }),

    check({
      ...base,
      id: 'redis.memory',
      title: 'Redis has free memory',
      severity: 'warning',
      run: ctx =>
        attempt(ctx, 'redis', async () => {
          let memory = await info('memory');
          let used = Number(memory.used_memory);
          let max = Number(memory.maxmemory);
          if (!max) return ctx.pass('No maxmemory limit is set.');

          let ratio = used / max;
          let details = {
            usedMb: Math.round(used / 1024 / 1024),
            maxMb: Math.round(max / 1024 / 1024)
          };

          if (ratio > memoryWarnRatio) {
            return ctx.warn({
              message: `Redis uses ${Math.round(ratio * 100)}% of maxmemory.`,
              resolution: { summary: 'Raise maxmemory or give Redis more memory.' },
              details
            });
          }

          return ctx.pass(`Redis uses ${Math.round(ratio * 100)}% of maxmemory.`, details);
        })
    }),

    check({
      ...base,
      id: 'redis.persistence',
      title: 'Redis persistence works',
      severity: 'warning',
      run: ctx =>
        attempt(ctx, 'redis', async () => {
          let persistence = await info('persistence');
          let failing = [
            persistence.rdb_last_bgsave_status == 'err' ? 'RDB snapshot' : null,
            persistence.aof_last_write_status == 'err' ? 'AOF write' : null
          ].filter(Boolean);

          if (!failing.length) return ctx.pass('No persistence errors.');

          return ctx.warn({
            message: `The last ${failing.join(' and ')} failed.`,
            resolution: { summary: 'Check the Redis logs and free disk space on its volume.' }
          });
        })
    })
  ];
};
