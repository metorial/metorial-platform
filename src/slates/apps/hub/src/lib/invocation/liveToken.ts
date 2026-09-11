import { generatePlainId } from '@lowerdeck/id';
import { createRedisClient } from '@lowerdeck/redis';
import { serialize } from '@lowerdeck/serialize';
import { env } from '../../env';

let getRedis = createRedisClient({ redisUrl: env.service.REDIS_URL }).lazy();

export interface LiveInvocationTokenPayload {
  invocationId: string;
  tenantOid: bigint;
}

let TOKEN_TTL_SECONDS = 60;
let TOKEN_INTERNALS_TTL_SECONDS = 60 * 15;
let RENEW_INTERVAL_MS = 20_000;

let tokenKey = (token: string) => `slates-hub:live-invocation:${token}`;
let countKey = (token: string) => `slates-hub:live-invocation:${token}:count`;
let sizeKey = (token: string) => `slates-hub:live-invocation:${token}:size`;

export interface LiveInvocationToken {
  token: string;
  release: () => Promise<void>;
}

export let mintLiveInvocationToken = async (
  payload: LiveInvocationTokenPayload
): Promise<LiveInvocationToken> => {
  let token = generatePlainId(35);
  let r = await getRedis();

  await r.set(tokenKey(token), serialize.encode(payload), { EX: TOKEN_TTL_SECONDS });

  let timer = setInterval(() => {
    r.expire(tokenKey(token), TOKEN_TTL_SECONDS).catch(() => {});
  }, RENEW_INTERVAL_MS);

  let released = false;

  return {
    token,
    release: async () => {
      if (released) return;
      released = true;

      clearInterval(timer);
      await Promise.all([
        r.del(tokenKey(token)),
        r.del(countKey(token)),
        r.del(sizeKey(token))
      ]);
    }
  };
};

export let resolveLiveInvocationToken = async (
  token: string
): Promise<LiveInvocationTokenPayload | null> => {
  let raw = await (await getRedis()).get(tokenKey(token));
  return raw ? (serialize.decode(raw) as LiveInvocationTokenPayload) : null;
};

export let reserveAttachmentBudget = async (
  token: string,
  d: { count: number; declaredSizeBytes: number }
) => {
  let r = await getRedis();
  let [newCount, newSize] = await Promise.all([
    r.incrBy(countKey(token), d.count),
    r.incrBy(sizeKey(token), d.declaredSizeBytes)
  ]);
  await Promise.all([
    r.expire(countKey(token), TOKEN_INTERNALS_TTL_SECONDS),
    r.expire(sizeKey(token), TOKEN_INTERNALS_TTL_SECONDS)
  ]);

  return { newCount, newSize };
};

export let releaseAttachmentBudget = async (
  token: string,
  d: { count: number; declaredSizeBytes: number }
) => {
  let r = await getRedis();
  await Promise.all([
    r.incrBy(countKey(token), -d.count),
    r.incrBy(sizeKey(token), -d.declaredSizeBytes)
  ]);
};
